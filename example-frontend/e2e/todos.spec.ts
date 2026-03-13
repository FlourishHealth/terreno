import {expect, test} from "@playwright/test";
import {clearTodos} from "./helpers/clearTodos";
import {loginAs} from "./helpers/login";

test.describe("Todos", () => {
  test.beforeEach(async ({page}) => {
    await clearTodos();
    await loginAs(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("todos screen renders correctly", async ({page}) => {
    await expect(page.getByTestId("todos-new-title-input")).toBeVisible();
    await expect(page.getByTestId("todos-add-button")).toBeVisible();
    await expect(page.getByTestId("todos-empty-text")).toBeVisible();
  });

  test("user can create a todo", async ({page}) => {
    await page.getByTestId("todos-new-title-input").fill("Buy groceries");
    await page.getByTestId("todos-add-button").click();

    await page.locator('[data-testid^="todos-item-"]').first().waitFor({state: "visible"});
    await expect(page.getByTestId("todos-empty-text")).not.toBeVisible();
    await expect(page.getByText("Buy groceries")).toBeVisible();
    // Input should be cleared after creation
    await expect(page.getByTestId("todos-new-title-input")).toHaveValue("");
  });

  test("user can complete a todo", async ({page}) => {
    await page.getByTestId("todos-new-title-input").fill("Mark me done");
    await page.getByTestId("todos-add-button").click();
    await page.locator('[data-testid^="todos-item-"]').first().waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const toggleButton = page.locator('[data-testid^="todos-toggle-"]').first();
    await toggleButton.waitFor({state: "visible"});
    await toggleButton.click({force: true});

    // Completed section appears
    await page.getByTestId("todos-completed-section-toggle").waitFor({state: "visible"});
    // Incomplete section shows empty state again
    await expect(page.getByTestId("todos-empty-text")).toBeVisible();
    // Todo title still visible in completed section
    await expect(page.getByText("Mark me done")).toBeVisible();
  });

  test("user can delete a todo", async ({page}) => {
    await page.getByTestId("todos-new-title-input").fill("Delete me");
    await page.getByTestId("todos-add-button").click();
    await page.locator('[data-testid^="todos-item-"]').first().waitFor({state: "visible"});
    await page.waitForLoadState("networkidle");

    const deleteButton = page.locator('[data-testid^="todos-delete-"]').first();
    await deleteButton.waitFor({state: "visible"});
    await deleteButton.click({force: true});

    await page.locator('[data-testid^="todos-item-"]').first().waitFor({state: "hidden"});
    await expect(page.getByTestId("todos-empty-text")).toBeVisible();
  });

  test("completed section can be collapsed and expanded", async ({page}) => {
    await page.getByTestId("todos-new-title-input").fill("Collapsible todo");
    await page.getByTestId("todos-add-button").click();
    await page.locator('[data-testid^="todos-item-"]').first().waitFor({state: "visible"});

    // Complete the todo so the completed section appears
    await page.waitForLoadState("networkidle");
    const toggleButton = page.locator('[data-testid^="todos-toggle-"]').first();
    await toggleButton.waitFor({state: "visible"});
    await toggleButton.click({force: true});
    await page.getByTestId("todos-completed-section-toggle").waitFor({state: "visible"});

    const completedItem = page.locator('[data-testid^="todos-item-"]').first();
    await completedItem.waitFor({state: "visible"});

    // Collapse the completed section
    await page.getByTestId("todos-completed-section-toggle").click({force: true});
    await completedItem.waitFor({state: "hidden"});

    // Expand it again
    await page.getByTestId("todos-completed-section-toggle").click({force: true});
    await completedItem.waitFor({state: "visible"});
  });
});
