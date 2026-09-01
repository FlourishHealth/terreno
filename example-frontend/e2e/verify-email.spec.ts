import {expect, test} from "./fixtures/test";

test.describe("Verify email", () => {
  test("shows a missing-token message without a token query param", async ({page}) => {
    await page.goto("/verifyEmail");
    await page.getByTestId("verify-email-screen").waitFor({state: "visible"});
    await expect(page.getByTestId("verify-email-missing-token")).toBeVisible();
    await expect(page.getByTestId("verify-email-submit")).toBeDisabled();
  });

  test("enables confirm when a token is present", async ({page}) => {
    await page.goto("/verifyEmail?token=test-token");
    await page.getByTestId("verify-email-screen").waitFor({state: "visible"});
    await expect(page.getByTestId("verify-email-missing-token")).toHaveCount(0);
    await expect(page.getByTestId("verify-email-submit")).toBeEnabled();
  });
});
