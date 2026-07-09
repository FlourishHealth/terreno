/**
 * SyncDB offline mutations (AC-4, AC-6): optimistic local apply, durable outbox
 * queueing, and replay on reconnect. Shared suite notes and helpers live in
 * helpers/syncdbSuite.ts. Uses a dedicated user so it can run in parallel with the
 * other syncdb-*.spec.ts files.
 */
import {expect, test} from "./fixtures/test";
import {SYNCDB_OFFLINE_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import {
  allowSyncDbNoise,
  CONVERGE_TIMEOUT,
  goSyncOffline,
  goSyncOnline,
  installOfflineControl,
  openSyncTodos,
  todoItemByTitle,
  waitForSyncTodosScreen,
} from "./helpers/syncdbSuite";
import {clearTodosAs, createTodoAs, listTodosAs} from "./helpers/todosApi";

const USER = SYNCDB_OFFLINE_USER;

test.describe("SyncDB offline mutations (AC-4, AC-6)", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(USER);
    // Sentinel todo: waiting for a bootstrapped item proves syncDb.start() has
    // completed (the screen renders and accepts input before the client is ready).
    const sentinel = await createTodoAs(USER, "Pre-synced sentinel");
    await installOfflineControl(page);
    await loginAs(page, USER);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${sentinel._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("offline create applies instantly, queues, and syncs on reconnect", async ({page}) => {
    await goSyncOffline(page);

    await page.getByTestId("todos-title-input").fill("Offline milk run");
    await page.getByTestId("todos-create-button").click();

    // Optimistic local apply — visible before any network round trip.
    await expect(todoItemByTitle(page, "Offline milk run")).toBeVisible();
    await expect(page.getByTestId("sync-queued-count")).toBeVisible();
    await expect(page.getByTestId("sync-queued-count")).toContainText("1");

    await goSyncOnline(page);

    // Queue drains and the todo survives (server-acked).
    await expect(page.getByTestId("sync-queued-count")).toBeHidden({timeout: CONVERGE_TIMEOUT});
    await expect(todoItemByTitle(page, "Offline milk run")).toBeVisible();
    await expect
      .poll(async () => (await listTodosAs(USER)).map((todo) => todo.title), {
        timeout: CONVERGE_TIMEOUT,
      })
      .toContain("Offline milk run");

    // The todo persists across a reload (re-hydrated locally, confirmed by server).
    await page.reload();
    await waitForSyncTodosScreen(page);
    await expect(todoItemByTitle(page, "Offline milk run")).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("offline toggle and delete apply locally and replay on reconnect", async ({page}) => {
    const toggled = await createTodoAs(USER, "Toggle me offline");
    const doomed = await createTodoAs(USER, "Delete me offline");
    await expect(page.getByTestId(`todo-item-${toggled._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
    await expect(page.getByTestId(`todo-item-${doomed._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });

    await goSyncOffline(page);

    // Toggle completion — the item moves to the Completed section immediately.
    await page.getByTestId(`todo-toggle-${toggled._id}-clickable`).click();
    await expect(page.getByTestId("todos-completed-section")).toBeVisible();
    await expect(
      page.getByTestId("todos-completed-section").getByTestId(`todo-item-${toggled._id}`)
    ).toBeVisible();

    // Delete — the item disappears immediately.
    await page.getByTestId(`todo-delete-${doomed._id}`).click();
    await expect(page.getByTestId(`todo-item-${doomed._id}`)).toBeHidden();

    await expect(page.getByTestId("sync-queued-count")).toContainText("2");

    await goSyncOnline(page);
    await expect(page.getByTestId("sync-queued-count")).toBeHidden({timeout: CONVERGE_TIMEOUT});

    // Server state converges: toggled todo completed, deleted todo gone.
    await expect
      .poll(
        async () => {
          const todos = await listTodosAs(USER);
          return {
            deletedGone: !todos.some((todo) => todo._id === doomed._id),
            toggledCompleted: todos.find((todo) => todo._id === toggled._id)?.completed ?? false,
          };
        },
        {timeout: CONVERGE_TIMEOUT}
      )
      .toEqual({deletedGone: true, toggledCompleted: true});

    // State also converges across a reload.
    await page.reload();
    await waitForSyncTodosScreen(page);
    await expect(
      page.getByTestId("todos-completed-section").getByTestId(`todo-item-${toggled._id}`)
    ).toBeVisible({timeout: CONVERGE_TIMEOUT});
    await expect(page.getByTestId(`todo-item-${doomed._id}`)).toBeHidden();
  });
});
