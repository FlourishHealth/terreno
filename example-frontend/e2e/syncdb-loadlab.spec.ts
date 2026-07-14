/**
 * SyncDB Load Lab (Phase F4): client-side load e2e. Drives the admin-guarded
 * `/loadtest/todos/*` routes (example-backend/src/api/loadtest.ts) directly via REST
 * — bypassing the SyncLabScreen UI entirely, since these are plain server-side writes
 * against the owner-scoped todos collection and the generated SDK has no hooks for
 * them (SyncLabScreen calls them with `fetch` too) — while a real browser session
 * stays mounted on the synced Todos screen, so the running @terreno/syncdb client
 * absorbs the resulting `sync:delta` stream exactly as it would for "another client"
 * mutating shared data.
 *
 * Unlike syncdb-load-delta.spec.ts (which seeds a handful of todos via the plain
 * `/todos` CRUD routes and asserts individual `todo-item-{id}` rows), this spec
 * generates thousands of documents and therefore asserts ONLY the `todos-count`
 * testID (SyncTodosScreen.tsx) converging to an exact expected total — asserting on
 * thousands of unvirtualized DOM rows here would be slow and flaky. See
 * SyncTodosScreen.tsx: the todo list is intentionally left as a plain `.map()` inside
 * a ScrollView (not virtualized) since this spec never inspects individual rows.
 *
 * Shared suite notes/helpers live in helpers/syncdbSuite.ts. Uses a dedicated
 * admin-capable user (SYNCDB_LOADLAB_USER) so it can run in parallel with the other
 * syncdb-*.spec.ts files and so the admin-guarded loadtest routes are callable.
 */
import {expect, test} from "./fixtures/test";
import {SYNCDB_LOADLAB_USER} from "./fixtures/testUsers";
import {signUpOrSignInBetterAuth} from "./helpers/betterAuthSession";
import {loginAs} from "./helpers/login";
import {allowSyncDbNoise, CONVERGE_TIMEOUT, openSyncTodos} from "./helpers/syncdbSuite";

const USER = SYNCDB_LOADLAB_USER;
const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const GENERATE_COUNT = 2000;
const CHURN_ROUNDS = 10;
const CHURN_BODY = {creates: 20, deletes: 10, updates: 20};

// 2000 initial docs + 10 churn rounds is a much heavier convergence scenario than the
// rest of the syncdb-*.spec.ts suite, so this spec gets a generous multiple of the
// standard CONVERGE_TIMEOUT rather than sharing the default budget.
const LOAD_CONVERGE_TIMEOUT = CONVERGE_TIMEOUT * 3;

interface LoadTestResult {
  created?: number;
  updated?: number;
  deleted?: number;
}

/** Thin REST client for the admin-guarded /loadtest/todos/* routes, bearer-authed as USER. */
class LoadTestClient {
  constructor(
    private readonly request: import("@playwright/test").APIRequestContext,
    private readonly token: string
  ) {}

  static async create(
    request: import("@playwright/test").APIRequestContext
  ): Promise<LoadTestClient> {
    const token = await signUpOrSignInBetterAuth(request, USER);
    return new LoadTestClient(request, token);
  }

  private async post(path: string, data?: Record<string, unknown>): Promise<LoadTestResult> {
    const res = await this.request.post(`${API_URL}/loadtest/todos/${path}`, {
      data: data ?? {},
      headers: {authorization: `Bearer ${this.token}`},
    });
    if (!res.ok()) {
      throw new Error(`loadtest ${path} failed with status ${res.status()}`);
    }
    const json = (await res.json()) as {data?: LoadTestResult};
    return json.data ?? {};
  }

  clear(): Promise<LoadTestResult> {
    return this.post("clear");
  }

  generate(count: number): Promise<LoadTestResult> {
    return this.post("generate", {count});
  }

  churn(body: {creates: number; updates: number; deletes: number}): Promise<LoadTestResult> {
    return this.post("churn", body);
  }

  /** Cheap total-count cross-check: modelRouter's list envelope includes `total`. */
  async totalCount(): Promise<number> {
    const res = await this.request.get(`${API_URL}/todos?limit=1`, {
      headers: {authorization: `Bearer ${this.token}`},
    });
    if (!res.ok()) {
      throw new Error(`GET /todos?limit=1 failed with status ${res.status()}`);
    }
    const json = (await res.json()) as {total?: number};
    return json.total ?? -1;
  }
}

const pollTodosCount = (page: import("@playwright/test").Page): Promise<number> => {
  return page
    .getByTestId("todos-count")
    .textContent()
    .then((text) => Number(text));
};

test.describe("SyncDB Load Lab @load", {tag: "@load"}, () => {
  // 2000-doc generation + 10 churn rounds well exceeds the default per-test budget
  // used by the rest of the syncdb-*.spec.ts suite.
  test.describe.configure({timeout: 180_000});

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await loginAs(page, USER);
    await openSyncTodos(page);
  });

  test("2000-doc generate + churn rounds converge to an exact count", async ({page, request}) => {
    const loadTest = await LoadTestClient.create(request);

    // Reset to a known 0 state so the final assertion is an exact count rather than
    // "at least N" (the suite user's data may carry over between local runs).
    await loadTest.clear();

    let expectedCount = 0;

    const initialStart = Date.now();
    const generated = await loadTest.generate(GENERATE_COUNT);
    expectedCount += generated.created ?? 0;

    await expect
      .poll(async () => pollTodosCount(page), {timeout: LOAD_CONVERGE_TIMEOUT})
      .toBe(expectedCount);
    const initialConvergeMs = Date.now() - initialStart;
    test.info().annotations.push({
      description: `initial ${GENERATE_COUNT}-doc convergence: ${initialConvergeMs}ms`,
      type: "timing",
    });

    // Several churn rounds with the page open: the live client should keep absorbing
    // a continuous stream of inbound sync:delta patches while mounted. Rounds are
    // fired back-to-back without waiting for full convergence between them — only
    // the final round's convergence is asserted — so this also exercises the client
    // catching up on a backlog rather than always processing one delta at a time.
    const churnStart = Date.now();
    for (let round = 0; round < CHURN_ROUNDS; round++) {
      const result = await loadTest.churn(CHURN_BODY);
      expectedCount += (result.created ?? 0) - (result.deleted ?? 0);
    }

    await expect
      .poll(async () => pollTodosCount(page), {timeout: LOAD_CONVERGE_TIMEOUT})
      .toBe(expectedCount);
    const churnConvergeMs = Date.now() - churnStart;
    test.info().annotations.push({
      description: `${CHURN_ROUNDS} churn rounds final convergence: ${churnConvergeMs}ms`,
      type: "timing",
    });

    // Cross-check against the server's own total via the cheap `?limit=1` list
    // envelope (avoids paginating through thousands of rows just to count them).
    const serverTotal = await loadTest.totalCount();
    expect(serverTotal).toBe(expectedCount);
  });
});
