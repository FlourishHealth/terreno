/**
 * SyncDB conflict resolution (AC-10, AC-11, AC-12): surfacing both versions and the
 * "use server" / "keep mine" resolutions. Shared suite notes and helpers live in
 * helpers/syncdbSuite.ts. Uses a dedicated user so it can run in parallel with the
 * other syncdb-*.spec.ts files.
 */
import type {Page} from "@playwright/test";
import {expect, test} from "./fixtures/test";
import {SYNCDB_CONFLICTS_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import {
  allowSyncDbNoise,
  clickTodoToggle,
  CONVERGE_TIMEOUT,
  goSyncOffline,
  goSyncOnline,
  installOfflineControl,
  openSyncTodos,
  waitForSyncTodosScreen,
} from "./helpers/syncdbSuite";
import {clearTodosAs, createTodoAs, listTodosAs, patchTodoAs} from "./helpers/todosApi";

const USER = SYNCDB_CONFLICTS_USER;

test.describe("SyncDB conflict resolution (AC-10, AC-11, AC-12)", () => {
  let target: {_id: string; title: string};

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(USER);
    target = await createTodoAs(USER, "Conflict target");
    await installOfflineControl(page);
    await loginAs(page, USER);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${target._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  /**
   * Builds a conflict: offline local completion toggle racing a concurrent
   * server-side title edit (REST). The Sync Todos UI can also rename titles;
   * this helper keeps using the toggle + REST path for a deterministic cross-field race.
   */
  const produceConflict = async (page: Page): Promise<void> => {
    await goSyncOffline(page);
    await clickTodoToggle(page, target._id);
    await expect(page.getByTestId("sync-queued-count")).toContainText("1");

    // "Another client" edits the same todo while we're offline.
    await patchTodoAs(USER, target._id, {title: "Server edit"});

    await goSyncOnline(page);
    await expect(page.getByTestId("sync-conflict-badge-clickable")).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  };

  test("conflict surfaces both timed versions; 'use all other versions' accepts the saved copy", async ({
    page,
  }) => {
    await produceConflict(page);

    await page.getByTestId("sync-conflict-badge-clickable").click();
    await expect(page.getByTestId("conflict-sheet")).toBeVisible();
    const conflictItem = page.getByTestId(`conflict-item-${target._id}`);
    await expect(conflictItem).toBeVisible();
    // Both versions render side by side: the local snapshot (still titled
    // "Conflict target") and the server version ("Server edit").
    await expect(conflictItem).toContainText("Conflict target");
    await expect(conflictItem).toContainText("Server edit");
    await expect(page.getByTestId(`conflict-local-time-${target._id}`)).not.toHaveText(
      "Time unavailable"
    );
    await expect(page.getByTestId(`conflict-server-time-${target._id}`)).not.toHaveText(
      "Time unavailable"
    );

    await page.getByRole("button", {exact: true, name: "Use all other versions"}).click();
    await page.getByRole("button", {exact: true, name: "Confirm"}).click();

    await expect(page.getByTestId("sync-conflict-badge-clickable")).toBeHidden({
      timeout: CONVERGE_TIMEOUT,
    });
    // Local store now holds the server version: new title, still incomplete.
    await expect(page.getByTestId(`todo-item-${target._id}`)).toContainText("Server edit", {
      timeout: CONVERGE_TIMEOUT,
    });
    await expect(page.getByTestId(`todo-item-${target._id}`)).toHaveAttribute(
      "aria-label",
      "incomplete todo"
    );

    // No mutation was re-sent — the server keeps completed=false.
    const serverTodos = await listTodosAs(USER);
    const serverTodo = serverTodos.find((todo) => todo._id === target._id);
    expect(serverTodo?.completed).toBe(false);
    expect(serverTodo?.title).toBe("Server edit");
  });

  test("resolved conflicts stay cleared after a page reload (no husk rows)", async ({page}) => {
    await produceConflict(page);

    await page.getByTestId("sync-conflict-badge-clickable").click();
    await page.getByRole("button", {exact: true, name: "Use all other versions"}).click();
    await page.getByRole("button", {exact: true, name: "Confirm"}).click();

    await expect(page.getByTestId("sync-conflict-badge-clickable")).toBeHidden({
      timeout: CONVERGE_TIMEOUT,
    });

    await page.reload();
    await waitForSyncTodosScreen(page);
    await expect(page.getByTestId(`todo-item-${target._id}`)).toContainText("Server edit", {
      timeout: CONVERGE_TIMEOUT,
    });
    await expect(page.getByTestId("sync-conflict-badge-clickable")).toBeHidden({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("'keep my change' re-applies the local version to the server", async ({page}) => {
    await produceConflict(page);

    await page.getByTestId("sync-conflict-badge-clickable").click();
    await expect(page.getByTestId(`conflict-item-${target._id}`)).toBeVisible();
    await page.getByRole("button", {exact: true, name: "Keep my change"}).click();

    await expect(page.getByTestId("sync-conflict-badge-clickable")).toBeHidden({
      timeout: CONVERGE_TIMEOUT,
    });
    await expect(page.getByTestId("sync-queued-count")).toBeHidden({timeout: CONVERGE_TIMEOUT});

    // The local value (completed=true) wins on the server too; the concurrent
    // title edit is untouched because keep-mine re-applies only the local fields.
    await expect
      .poll(
        async () => {
          const todos = await listTodosAs(USER);
          const todo = todos.find((t) => t._id === target._id);
          return {completed: todo?.completed ?? false, title: todo?.title ?? ""};
        },
        {timeout: CONVERGE_TIMEOUT}
      )
      .toEqual({completed: true, title: "Server edit"});

    // Local UI reflects the win: the todo is marked completed.
    await expect(page.getByTestId(`todo-item-${target._id}`)).toHaveAttribute(
      "aria-label",
      "completed todo",
      {timeout: CONVERGE_TIMEOUT}
    );
  });
});
