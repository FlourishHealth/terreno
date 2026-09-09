import {expect, test} from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_SPA_E2E_EMAIL ?? "admin-spa-e2e@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_SPA_E2E_PASSWORD ?? "admin-spa-e2e-password";

/**
 * Task 1.7: SPA `/console` Todos create → edit → delete.
 * Create uses same-origin POST `/todos` after Better Auth login (admin create strips ownerId).
 */
test.describe("admin SPA Todo CRUD smoke", () => {
  test("creates, edits, and deletes a Todo from /console", async ({page}) => {
    await page.goto("/console/login");
    await expect(page.getByTestId("admin-spa-login-email")).toBeVisible();
    await page.getByTestId("admin-spa-login-email").fill(ADMIN_EMAIL);
    await page.getByTestId("admin-spa-login-password").fill(ADMIN_PASSWORD);
    await page.getByTestId("admin-spa-login-submit").click();
    await page.waitForURL(/\/console\/?$/, {timeout: 30_000});
    await expect(page.getByTestId("admin-home-models-grid-Todo-clickable")).toBeVisible({
      timeout: 30_000,
    });

    const createdTitle = `SPA CRUD ${Date.now()}`;
    const editedTitle = `${createdTitle} edited`;
    const createResponse = await page.request.post("/todos", {data: {title: createdTitle}});
    expect(createResponse.ok()).toBeTruthy();

    await page.goto("/console/Todo");
    await page.getByTestId("admin-create-button").waitFor({state: "visible", timeout: 15_000});
    await expect(page.getByText(createdTitle).locator("visible=true").first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByText(createdTitle).locator("visible=true").first().click();
    await page.getByTestId("admin-save-button").waitFor({state: "visible", timeout: 15_000});
    await page.getByTestId("admin-field-title").fill(editedTitle);
    await page.getByTestId("admin-save-button").click();
    await page.getByTestId("admin-create-button").waitFor({state: "visible", timeout: 15_000});
    await expect(page.getByText(editedTitle).locator("visible=true").first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByText(editedTitle).locator("visible=true").first().click();
    await page.getByTestId("admin-delete-button").waitFor({state: "visible", timeout: 15_000});
    await page.getByTestId("admin-delete-button").click();
    await page.getByRole("button", {name: "Confirm"}).click();
    await page.getByTestId("admin-create-button").waitFor({state: "visible", timeout: 15_000});
    await expect(page.getByText(editedTitle).locator("visible=true")).toHaveCount(0);
  });
});
