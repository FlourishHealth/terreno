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

    // Dispatch a click event on the toggle — RNW Pressable responds to DOM click events
    const toggle = todoItem.locator('[data-testid^="todos-toggle-"]');
    await toggle.waitFor({state: "visible"});
    await toggle.dispatchEvent("click");

    // Completed section appears
    await page.getByTestId("todos-completed-section-toggle").waitFor({state: "visible"});
    // Incomplete section shows empty state again
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();
    // Todo title still visible in completed section
    await expect(page.getByText("Mark me done").first()).toBeVisible();
  });

  test("user can delete a todo", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Delete me");
    await page.getByTestId("todos-add-button").first().click();

    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    // Dispatch a click event on the delete button — RNW Pressable responds to DOM click events
    const deleteBtn = todoItem.locator('[data-testid^="todos-delete-"]');
    await deleteBtn.waitFor({state: "visible"});
    await deleteBtn.dispatchEvent("click");

    await page
      .locator('[data-testid^="todos-item-"]')
      .filter({visible: true})
      .first()
      .waitFor({state: "hidden"});
    await expect(page.getByTestId("todos-empty-text").first()).toBeVisible();
  });

  test("completed section can be collapsed and expanded", async ({page}) => {
    await page.getByTestId("todos-new-title-input").first().fill("Collapsible todo");
    await page.getByTestId("todos-add-button").first().click();

    const todoItem = page.locator('[data-testid^="todos-item-"]').filter({visible: true}).first();
    await todoItem.waitFor({state: "visible"});

    // Complete the todo so the completed section appears
    await page.waitForLoadState("networkidle");
    const toggle = todoItem.locator('[data-testid^="todos-toggle-"]');
    await toggle.waitFor({state: "visible"});
    await toggle.dispatchEvent("click");
    await page.getByTestId("todos-completed-section-toggle").waitFor({state: "visible"});

    const completedItem = page
      .locator('[data-testid^="todos-item-"]')
      .filter({visible: true})
      .first();
    await completedItem.waitFor({state: "visible"});

    // Collapse the completed section
    const sectionToggle = page.getByTestId("todos-completed-section-toggle");
    await sectionToggle.waitFor({state: "visible"});
    await sectionToggle.dispatchEvent("click");
    await completedItem.waitFor({state: "hidden"});

    // Expand it again
    await sectionToggle.dispatchEvent("click");
    await completedItem.waitFor({state: "visible"});
  });
});
