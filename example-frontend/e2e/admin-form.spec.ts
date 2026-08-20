import {expect, test} from "./fixtures/test";
import {loginAsAdmin} from "./helpers/adminAuth";

test.describe("Admin model form", () => {
  test("opens the contributed Todo create form and validates required fields", async ({page}) => {
    await loginAsAdmin(page);
    await page.goto("/admin/Todo");
    await page.getByTestId("admin-create-button").click();

    await expect(page.getByTestId("admin-save-button")).toBeVisible();
    await page.getByTestId("admin-save-button").click();
    await expect(page.getByText(/required/i).first()).toBeVisible();
  });
});
