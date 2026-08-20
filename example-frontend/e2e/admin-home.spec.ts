import {expect, test} from "./fixtures/test";
import {loginAsAdmin} from "./helpers/adminAuth";

test.describe("Admin home", () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
  });

  test("renders contributed models and home widgets", async ({page}) => {
    await expect(page.getByTestId("admin-home-models-grid-User-clickable")).toBeVisible();
    await expect(page.getByTestId("admin-home-models-grid-Todo-clickable")).toBeVisible();
    await expect(page.getByTestId("admin-home-widget-feature-flags-overrides")).toBeVisible();
  });
});
