import {expect, test} from "./fixtures/test";

test.describe("Forgot password", () => {
  test("falls back to the JWT route when Better Auth rejects the request", async ({
    consoleGuard,
    page,
  }) => {
    consoleGuard.allow("Failed to load resource: the server responded with a status of 404");
    let jwtRequestEmail: string | undefined;
    await page.route("**/api/auth/request-password-reset", async (route) => {
      await route.fulfill({
        body: JSON.stringify({message: "Better Auth reset unavailable"}),
        contentType: "application/json",
        status: 404,
      });
    });
    await page.route("**/auth/forgotPassword", async (route) => {
      const body = route.request().postDataJSON() as {email?: string};
      jwtRequestEmail = body.email;
      await route.fulfill({
        body: JSON.stringify({data: {ok: true}}),
        contentType: "application/json",
        status: 202,
      });
    });

    await page.goto("/forgotPassword");
    await page.getByTestId("forgot-password-email").fill("person@example.com");
    await page.getByTestId("forgot-password-submit").click();

    await expect(page.getByTestId("forgot-password-sent")).toBeVisible();
    expect(jwtRequestEmail).toBe("person@example.com");
  });
});
