import {expect, test} from "./fixtures/test";
import {loginAsAdmin} from "./helpers/adminAuth";

test.describe("Admin model form", () => {
  test("opens the contributed Todo create form and validates required fields", async ({
    consoleGuard,
    page,
  }) => {
    consoleGuard.allow("UTC is not a valid timezone");
    await loginAsAdmin(page);
    await page.goto("/admin/Todo/create");

    await expect(page.getByTestId("admin-save-button")).toBeVisible();
    await page.getByTestId("admin-save-button").click();
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });
});
