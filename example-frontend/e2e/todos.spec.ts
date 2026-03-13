import {expect, test} from "@playwright/test";
import {clearTodos} from "./helpers/clearTodos";
import {loginAs} from "./helpers/login";

test.describe("Todos", () => {
  test.beforeEach(async ({page}) => {
    await clearTodos();
    await loginAs(page);
    // Navigate explicitly to the todos tab root to land on the correct screen.
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Wait for the new-todo input which is always visible once the screen loads.
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("todos screen renders correctly", async ({page}) => {
    await expect(page.getByTestId("todos-new-title-input").first()).toBeVisible();
    await expect(page.getByTestId("todos-add-button").first()).toBeVisible();
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();
  });

  test("user can create a todo", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Buy groceries");
    await page.getByTestId("todos-add-button").first().click();

    await page
      .locator('[data-testid^="todos-item-"]')
      .filter({visible: true})
      .first()
      .waitFor({state: "visible"});
    await expect(page.getByTestId("todos-empty-text").first()).not.toBeVisible();
    await expect(page.getByText("Buy groceries").first()).toBeVisible();
    // Input should be cleared after creation
    await expect(page.getByTestId("todos-new-title-input").first()).toHaveValue("");
  });

  test("user can complete a todo", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Mark me done");
    await page.getByTestId("todos-add-button").first().click();

    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    // Capture item ID to use precise selectors
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    // Click the toggle for this specific item
    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();

    // Completed section appears — the todo moved to completed
    await page.getByTestId("todos-completed-section-toggle-clickable").waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");
    // Todo title visible in completed section
    await expect(page.getByText("Mark me done").first()).toBeVisible();
  });

  test("user can delete a todo", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Delete me");
    await page.getByTestId("todos-add-button").first().click();

    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    // Capture the specific item's testID so we wait for that exact item to disappear
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-deleted";
    const itemId = todoTestId.replace("todos-item-", "");
    const deleteBtn = page.getByTestId(`todos-delete-${itemId}`).filter({visible: true}).first();
    await deleteBtn.waitFor({state: "visible"});
    await deleteBtn.click();

    await page.getByTestId(todoTestId).waitFor({state: "hidden"});
    await page.waitForLoadState("networkidle");
    // Use waitFor instead of expect to handle brief loading states after delete
    await page.getByTestId("todos-empty-text").first().waitFor({state: "visible"});
  });

  test("completed section can be collapsed and expanded", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Collapsible todo");
    await page.getByTestId("todos-add-button").first().click();

    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    // Capture item ID to use precise selectors
    const todoTestId = (await todoItem.getAttribute("data-testid")) ?? "todos-item-unknown";
    const itemId = todoTestId.replace("todos-item-", "");

    // Complete the todo so the completed section appears
    const toggle = page
      .getByTestId(`todos-toggle-${itemId}-clickable`)
      .filter({visible: true})
      .first();
    await toggle.waitFor({state: "visible"});
    await toggle.click();
    await page.getByTestId("todos-completed-section-toggle-clickable").waitFor({state: "visible"});

    const completedItem = page
      .locator('[data-testid^="todos-item-"]')
      .filter({visible: true})
      .first();
    await completedItem.waitFor({state: "visible"});

    // Collapse the completed section
    const sectionToggle = page.getByTestId("todos-completed-section-toggle-clickable");
    await sectionToggle.click();
    await completedItem.waitFor({state: "hidden"});

    // Expand it again
    await sectionToggle.click();
    await completedItem.waitFor({state: "visible"});
  });
});
