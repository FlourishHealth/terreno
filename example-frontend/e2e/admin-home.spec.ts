import {expect, test} from "./fixtures/test";
import {loginAsAdmin} from "./helpers/adminAuth";
import {waitForAdminHome} from "./helpers/adminUi";

test.describe("Admin home", () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdmin(page);
    await page.goto("/admin");
    await waitForAdminHome(page);
  });

  test("renders contributed models and home widgets", async ({page}) => {
    await expect(
      page.getByText("Users", {exact: true}).locator("visible=true").first()
    ).toBeVisible();
    await expect(
      page.getByText("Todos", {exact: true}).locator("visible=true").first()
    ).toBeVisible();
    await expect(
      page.getByText("Feature flags", {exact: true}).locator("visible=true").first()
    ).toBeVisible();
  });
});
