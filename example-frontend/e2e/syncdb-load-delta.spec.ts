/**
 * SyncDB local-first load (AC-1) and live delta sync (AC-8). Shared suite notes and
 * helpers live in helpers/syncdbSuite.ts. Uses a dedicated user so it can run in
 * parallel with the other syncdb-*.spec.ts files while the use-syncdb flag is on.
 */
import {expect, test} from "./fixtures/test";
import {SYNCDB_LOAD_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import {setSyncDbFlag} from "./helpers/syncdbFlag";
import {
  allowSyncDbNoise,
  CONVERGE_TIMEOUT,
  createTodoViaUi,
  openSecondSession,
  openSyncTodos,
  todoItemByTitle,
} from "./helpers/syncdbSuite";
import {clearTodosAs, createTodoAs} from "./helpers/todosApi";

const USER = SYNCDB_LOAD_USER;

test.describe("SyncDB local-first load (AC-1)", () => {
  let seeded: Array<{_id: string; title: string}> = [];

  test.beforeAll(async () => {
    await setSyncDbFlag(true);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(USER);
    seeded = [];
    for (const title of ["Seeded one", "Seeded two", "Seeded three"]) {
      seeded.push(await createTodoAs(USER, title));
    }
    await loginAs(page, USER);
    await openSyncTodos(page);
  });

  test("seeded server todos render from the local store after login", async ({page}) => {
    for (const todo of seeded) {
      await expect(page.getByTestId(`todo-item-${todo._id}`)).toBeVisible({
        timeout: CONVERGE_TIMEOUT,
      });
    }
    await expect(page.getByTestId("sync-status-banner")).toBeAttached();
    await expect(page.getByTestId("sync-queued-count")).toBeHidden();
    await expect(page.getByTestId("sync-offline-indicator")).toBeHidden();
  });
});

test.describe("SyncDB live delta sync (AC-8)", () => {
  let sentinel: {_id: string};

  test.beforeAll(async () => {
    await setSyncDbFlag(true);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(USER);
    // Sentinel todo: rendering it proves each session's client finished starting.
    sentinel = await createTodoAs(USER, "Pre-synced sentinel");
    await loginAs(page, USER);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${sentinel._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("a todo created in another session appears without reload", async ({page, browser}) => {
    const {context, page: pageB} = await openSecondSession(browser, USER);
    try {
      // Wait for B's client to be fully started before mutating from it.
      await expect(pageB.getByTestId(`todo-item-${sentinel._id}`)).toBeVisible({
        timeout: CONVERGE_TIMEOUT,
      });
      await createTodoViaUi(pageB, "From the other tab");

      // Context A receives the change via sync:delta — no reload, no interaction.
      await expect(todoItemByTitle(page, "From the other tab")).toBeVisible({
        timeout: CONVERGE_TIMEOUT,
      });

      // Deleting it in B removes it from A live as well.
      const itemInB = todoItemByTitle(pageB, "From the other tab");
      const testId = (await itemInB.getAttribute("data-testid")) ?? "";
      const id = testId.replace("todo-item-", "");
      await pageB.getByTestId(`todo-delete-${id}`).click();
      await expect(todoItemByTitle(pageB, "From the other tab")).toBeHidden();
      await expect(todoItemByTitle(page, "From the other tab")).toBeHidden({
        timeout: CONVERGE_TIMEOUT,
      });
    } finally {
      await context.close();
    }
  });
});
