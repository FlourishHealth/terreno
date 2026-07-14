import {expect, test} from "./fixtures/test";
import {clearTodos} from "./helpers/clearTodos";
import {loginAs} from "./helpers/login";
import {
  allowSyncDbNoise,
  CONVERGE_TIMEOUT,
  createTodoViaUi,
  openSyncTodos,
  todoItemByTitle,
} from "./helpers/syncdbSuite";

test.describe("Todos", () => {
  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodos();
    await loginAs(page);
    await openSyncTodos(page);
  });

  test("todos screen renders correctly", async ({page}) => {
    await expect(page.getByTestId("todos-title-input")).toBeVisible();
    await expect(page.getByTestId("todos-create-button")).toBeVisible();
    await expect(page.getByTestId("todos-empty-state")).toBeVisible();
  });

  test("user can create a todo", async ({page}) => {
    await createTodoViaUi(page, "Buy groceries");
    await expect(page.getByTestId("todos-empty-state")).toHaveCount(0);
    await expect(page.getByText("Buy groceries").first()).toBeVisible();
    await expect(page.getByTestId("todos-title-input")).toHaveValue("");
  });

  test("user can complete a todo", async ({page}) => {
    await createTodoViaUi(page, "Mark me done");

    const todoItem = todoItemByTitle(page, "Mark me done");
    await todoItem.waitFor({state: "visible"});
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todo-item-unknown";
    const itemId = todoTestId.replace("todo-item-", "");

    await page.getByTestId(`todo-toggle-${itemId}-clickable`).click();
    await page.getByTestId("todos-completed-section").waitFor({state: "visible"});
    await expect(page.getByText("Mark me done").first()).toBeVisible();
  });

  test("user can delete a todo", async ({page}) => {
    await createTodoViaUi(page, "Delete me");

    const todoItem = todoItemByTitle(page, "Delete me");
    await todoItem.waitFor({state: "visible"});
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todo-item-deleted";
    const itemId = todoTestId.replace("todo-item-", "");

    await page.getByTestId(`todo-delete-${itemId}`).click();
    await expect(page.getByTestId(todoTestId)).toBeHidden({timeout: CONVERGE_TIMEOUT});
    await page.getByTestId("todos-empty-state").waitFor({state: "visible"});
  });

  test("completed todos appear in the completed section", async ({page}) => {
    await createTodoViaUi(page, "Completed todo");

    const todoItem = todoItemByTitle(page, "Completed todo");
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todo-item-unknown";
    const itemId = todoTestId.replace("todo-item-", "");

    await page.getByTestId(`todo-toggle-${itemId}-clickable`).click();
    await page.getByTestId("todos-completed-section").waitFor({state: "visible"});
    await expect(todoItemByTitle(page, "Completed todo")).toBeVisible();
  });
});
