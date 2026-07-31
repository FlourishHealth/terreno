import type {Page} from "@playwright/test";
import {TEST_USER} from "../fixtures/testUsers";

export const loginAs = async (page: Page, user = TEST_USER): Promise<void> => {
  await page.goto("/login");
  await page.getByTestId("login-screen").waitFor({state: "visible"});
  await page.getByTestId("login-screen-email-input").fill(user.email);
  await page.getByTestId("login-screen-password-input").fill(user.password);
  await page.getByTestId("login-screen-submit-button").click();
  await page.getByTestId("login-screen").first().waitFor({state: "hidden"});
  // login.tsx's own router.replace("/(tabs)") is still in flight when the login screen
  // hides — a caller that immediately does page.goto() to a different route (e.g.
  // loginAsAdmin() followed by page.goto("/admin")) can race that client-side redirect:
  // the hard navigation can land before Expo Router's replace resolves, which then
  // overrides it back to "/(tabs)". Waiting for the post-login UI to actually mount
  // closes that window before control returns to the caller.
  //
  // The tabs root is the usual landing spot, but a user with pending consents is
  // intercepted by the consent navigator and never reaches it — so accept either, and
  // let the caller assert which one it expected.
  await page
    .locator('[data-testid="todos-screen"], [data-testid="consent-form-footer"]')
    .first()
    .waitFor({state: "visible"});
};
