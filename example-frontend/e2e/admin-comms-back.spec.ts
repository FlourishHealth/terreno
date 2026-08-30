import {expect, test} from "./fixtures/test";
import {loginAsAdmin} from "./helpers/adminAuth";

test.describe("Admin comms back navigation", () => {
  test.beforeEach(async ({page}) => {
    await loginAsAdmin(page);
  });

  test("returns to admin home from the comms dashboard back arrow", async ({
    consoleGuard,
    page,
  }) => {
    consoleGuard.allow("UTC is not a valid timezone");
    await page.goto("/admin/comms");
    await expect(page).toHaveURL(/\/admin\/comms/);
    await expect(page.getByTestId("comms-dashboard")).toBeVisible();

    await page.getByLabel("Back").click();

    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByText("Users", {exact: true}).first()).toBeVisible();
  });
});
