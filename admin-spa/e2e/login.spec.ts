import {expect, test} from "@playwright/test";

/**
 * End-to-end: an anonymous visitor opening the SPA root is redirected to the login
 * screen, which renders the config-driven brand name and auth providers. Exercises the
 * full client stack — AppConfigGate (loads app-config.json), StoreProvider (builds the
 * better-auth client + Redux store), and AdminGate (no session -> /login).
 */
test("anonymous visitor is redirected to the login screen", async ({page}) => {
  await page.goto("/console/");

  // AdminGate redirects unauthenticated users to /login (client-side).
  await page.waitForURL(/\/console\/login/, {timeout: 20_000});

  await expect(page.getByText("Terreno Admin (e2e)")).toBeVisible();
  await expect(page.getByTestId("admin-spa-login-email")).toBeVisible();
  await expect(page.getByTestId("admin-spa-login-password")).toBeVisible();
  await expect(page.getByTestId("admin-spa-login-submit")).toBeVisible();
  // app-config declares the google provider, so the social button renders.
  await expect(page.getByTestId("admin-spa-login-google")).toBeVisible();
});
