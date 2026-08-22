/**
 * SyncDB chaos (Phase F3): flapping connectivity, jittered/reordered WebSocket
 * frames, and live-socket drops racing a batch of in-flight mutations. Shared suite
 * notes and helpers live in helpers/syncdbSuite.ts. Uses a dedicated user so it can
 * run in parallel with the other syncdb-*.spec.ts files.
 *
 * The load-bearing assertion is zero duplicates: flapping mid-ack is specifically
 * designed to try to forge duplicate deliveries (client resends a mutation whose ack
 * was lost to a socket drop, server change-stream re-delivers a delta across a
 * reconnect, etc). The idempotency ledger + outbox dedup must prevent that, so this
 * spec asserts per-title counts rather than just comparing set/array lengths (which
 * wouldn't catch a duplicate-plus-a-missing-item false negative).
 */

import {expect, test} from "./fixtures/test";
import {SYNCDB_CHAOS_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import type {ChaosControl} from "./helpers/syncdbSuite";
import {
  allowSyncDbNoise,
  CONVERGE_TIMEOUT,
  createTodoViaUi,
  forceSyncReconnect,
  installChaosControl,
  openSyncTodos,
  startSyncFlapLoop,
} from "./helpers/syncdbSuite";
import {clearTodosAs, listTodosAs} from "./helpers/todosApi";

const USER = SYNCDB_CHAOS_USER;
const MUTATION_COUNT = 30;
const CHAOS_LATENCY_MS = 100;

/** Every title created in this test, e.g. ["chaos-todo-0", ..., "chaos-todo-29"]. */
const chaosTitles = (): string[] =>
  Array.from({length: MUTATION_COUNT}, (_, i) => `chaos-todo-${i}`);

/** Assert no value in `items` appears more than once — the zero-duplicates check. */
const assertNoDuplicates = (items: string[], label: string): void => {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  const duplicated = [...counts.entries()].filter(([, count]) => count > 1);
  expect(duplicated, `${label} had duplicate titles: ${JSON.stringify(duplicated)}`).toEqual([]);
};

test.describe("SyncDB chaos (reconnect-mid-drain)", () => {
  let chaos: ChaosControl;

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(USER);
    // installChaosControl must run before login (and only once per page): it wraps
    // every socket.io connection the page opens via page.routeWebSocket, and Playwright
    // does not expect a second overlapping handler registered for the same pattern.
    // The test body reuses this same `chaos` handle rather than installing again.
    chaos = await installChaosControl(page, {latencyMs: CHAOS_LATENCY_MS});
    await loginAs(page, USER);
    await openSyncTodos(page);
  });

  test("30 UI mutations survive flapping connectivity with zero duplicates", async ({page}) => {
    // 30 mutations racing offline/online flaps + jittered frames can take longer than
    // the default local 60s / CI 30s budget to fully converge.
    test.setTimeout(120_000);

    const flap = startSyncFlapLoop(chaos, {maxDwellMs: 8000, minDwellMs: 1000});

    const titles = chaosTitles();
    for (const title of titles) {
      await createTodoViaUi(page, title);
    }

    // Stop chaos: flap loop settles into ONLINE, then latency injection is cleared so
    // the queue can drain at full speed for convergence.
    await flap.stop();
    await chaos.stop();

    // 30 flaps grow the socket's reconnect backoff, so the drain can sit idle waiting
    // out a delay longer than CONVERGE_TIMEOUT even though connectivity is restored.
    // Force the reconnect instead of racing the backoff — the drain itself is what this
    // test is measuring, not Socket.io's retry schedule. CircleCI serves a production
    // static export (__DEV__ false) so the visible Sync Lab panel is omitted; dispatch
    // the window event the panel always listens for.
    await forceSyncReconnect(page);

    // The banner shows queued state via ONE of two testIDs depending on volume:
    // "sync-queued-count" (<=20 queued) or "sync-drain-progress" (>20 queued —
    // this test's 30 mutations can cross that threshold under chaos). Neither
    // must be present once the drain is truly finished, or "converged" would
    // be a false positive the instant the queued count crosses back under the
    // progress threshold mid-drain.
    // Count, don't read text: textContent() auto-waits for the element to attach, so with
    // no actionTimeout configured it hangs instead of rejecting once the badges are gone —
    // i.e. exactly in the converged state this poll is waiting for. count() resolves
    // immediately with 0.
    await expect
      .poll(
        async () => {
          const [queuedCount, drainProgress] = await Promise.all([
            page.getByTestId("sync-queued-count").count(),
            page.getByTestId("sync-drain-progress").count(),
          ]);
          return queuedCount === 0 && drainProgress === 0;
        },
        {timeout: CONVERGE_TIMEOUT}
      )
      .toBe(true);

    // The list is a virtualized FlashList, so only the rows near the viewport are in the
    // DOM — the local total has to come from the section header's count, not from
    // counting rendered rows. What IS rendered still has to be duplicate-free: a
    // double-applied mutation would surface as two rows with the same title.
    await expect(page.getByTestId("todos-to-do-section")).toContainText(
      `To Do (${titles.length})`,
      {timeout: CONVERGE_TIMEOUT}
    );

    const localTitles = await page
      .locator('[data-testid^="todo-item-"]')
      .filter({hasText: /^chaos-todo-\d+$/})
      .allTextContents();

    await expect
      .poll(async () => (await listTodosAs(USER)).map((todo) => todo.title).sort(), {
        timeout: CONVERGE_TIMEOUT,
      })
      .toEqual([...titles].sort());

    const serverTitles = (await listTodosAs(USER)).map((todo) => todo.title);

    assertNoDuplicates(localTitles, "local DOM-rendered todo list");
    assertNoDuplicates(serverTitles, "REST-fetched todo list");

    // Every rendered row must be one of the titles this test created (no strays), and
    // the server must hold exactly the full set.
    expect(new Set(titles)).toEqual(new Set([...titles, ...localTitles]));
    expect(serverTitles.length).toBe(titles.length);
  });
});
