import {expect, test} from "./fixtures/test";

test.describe("Reset password", () => {
  test("shows a missing-token message without a token query param", async ({page}) => {
    await page.goto("/resetPassword");
    await page.getByTestId("reset-password-screen").waitFor({state: "visible"});
    await expect(page.getByTestId("reset-password-missing-token")).toBeVisible();
    await expect(page.getByTestId("reset-password-submit")).toBeDisabled();
  });

  test("enables submit when a token is present", async ({page}) => {
    await page.goto("/resetPassword?token=test-token");
    await page.getByTestId("reset-password-screen").waitFor({state: "visible"});
    await expect(page.getByTestId("reset-password-missing-token")).toHaveCount(0);
    await page.getByTestId("reset-password-password").fill("NewPassword123");
    await expect(page.getByTestId("reset-password-submit")).toBeEnabled();
  });
});
