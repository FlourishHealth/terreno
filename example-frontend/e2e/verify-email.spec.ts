import {expect, test} from "./fixtures/test";

test.describe("Verify email", () => {
  test("shows a missing-token message without a token query param", async ({page}) => {
    await page.goto("/verifyEmail");
    await page.getByTestId("verify-email-screen").waitFor({state: "visible"});
    await expect(page.getByTestId("verify-email-missing-token")).toBeVisible();
    await expect(page.getByTestId("verify-email-submit")).toBeDisabled();
  });

  test("enables confirm when a token is present", async ({page}) => {
    let verifyRequestMethod: string | undefined;
    let verifyRequestUrl: string | undefined;
    await page.route("**/api/auth/verify-email?token=*", async (route) => {
      verifyRequestMethod = route.request().method();
      verifyRequestUrl = route.request().url();
      await route.fulfill({body: JSON.stringify({status: true}), status: 200});
    });
    await page.goto("/verifyEmail?token=test-token");
    await page.getByTestId("verify-email-screen").waitFor({state: "visible"});
    await expect(page.getByTestId("verify-email-missing-token")).toHaveCount(0);
    await expect(page.getByTestId("verify-email-submit")).toBeEnabled();
    await page.getByTestId("verify-email-submit").click();
    await expect(page.getByTestId("verify-email-success")).toBeVisible();
    expect(verifyRequestMethod).toBe("GET");
    expect(verifyRequestUrl).toContain("token=test-token");
  });
});
