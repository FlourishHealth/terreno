import type {BrowserContext} from "@playwright/test";
import {expect, test} from "@playwright/test";
import {E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_NEEDS_SETUP_COOKIE} from "./credentials";

/** Marks this browser context as "no admin exists yet" for every subsequent request. */
const setNeedsSetupCookie = async (context: BrowserContext, baseURL: string): Promise<void> => {
  await context.addCookies([{name: E2E_NEEDS_SETUP_COOKIE, url: baseURL, value: "1"}]);
};

/**
 * End-to-end: the first-admin setup flow shown when the (mocked) backend reports no
 * admin user exists yet (`GET /admin/setup-status` → `needsSetup: true`, driven by the
 * per-context E2E_NEEDS_SETUP_COOKIE — see serveTestApp.ts). Exercises AdminGate's setup
 * redirect, the setup screen's sign-up-then-claim path, and its claim-only path for an
 * already-authenticated visitor.
 */
test.describe("first-admin setup flow", () => {
  test("anonymous visitor is redirected to setup instead of login", async ({page, baseURL}) => {
    await setNeedsSetupCookie(page.context(), baseURL ?? "http://localhost:4100");

    await page.goto("/console/");

    await page.waitForURL(/\/console\/setup/, {timeout: 20_000});
    await expect(page.getByText("No admin account exists yet.")).toBeVisible();
    await expect(page.getByTestId("admin-spa-setup-name")).toBeVisible();
    await expect(page.getByTestId("admin-spa-setup-email")).toBeVisible();
    await expect(page.getByTestId("admin-spa-setup-password")).toBeVisible();
    await expect(page.getByTestId("admin-spa-setup-submit")).toBeVisible();
  });

  test("creating the first admin account signs up, claims admin, and lands on the admin home", async ({
    page,
    baseURL,
  }) => {
    await setNeedsSetupCookie(page.context(), baseURL ?? "http://localhost:4100");

    await page.goto("/console/setup");
    await expect(page.getByTestId("admin-spa-setup-name")).toBeVisible();

    await page.getByTestId("admin-spa-setup-name").fill("First Admin");
    await page.getByTestId("admin-spa-setup-email").fill("first-admin@example.com");
    await page.getByTestId("admin-spa-setup-password").fill("first-admin-password");
    await page.getByTestId("admin-spa-setup-submit").click();

    // Successful sign-up + claim routes to the SPA root, rendering AdminHome from the
    // (mocked) /admin/config response — /admin/setup-claim clears the setup cookie
    // server-side, so this next navigation no longer bounces back to /setup.
    await page.waitForURL(/\/console\/?$/, {timeout: 20_000});
    await expect(page.getByTestId("admin-home-models-grid-Todo-clickable")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("an already signed-in visitor can claim admin access directly, without re-entering credentials", async ({
    page,
    baseURL,
  }) => {
    // Sign in normally first (no setup cookie yet), establishing a real session.
    await page.goto("/console/login");
    await page.getByTestId("admin-spa-login-email").fill(E2E_ADMIN_EMAIL);
    await page.getByTestId("admin-spa-login-password").fill(E2E_ADMIN_PASSWORD);
    await page.getByTestId("admin-spa-login-submit").click();
    await page.waitForURL(/\/console\/?$/, {timeout: 20_000});

    // Now simulate "no admin exists yet" and reload — AdminGate should send the already
    // signed-in visitor to /setup (not /login), and the screen should offer a claim-only
    // button since a session already exists.
    await setNeedsSetupCookie(page.context(), baseURL ?? "http://localhost:4100");
    await page.goto("/console/");
    await page.waitForURL(/\/console\/setup/, {timeout: 20_000});

    await expect(page.getByTestId("admin-spa-setup-name")).toHaveCount(0);
    await expect(page.getByTestId("admin-spa-setup-claim")).toBeVisible();
    await page.getByTestId("admin-spa-setup-claim").click();

    await page.waitForURL(/\/console\/?$/, {timeout: 20_000});
    await expect(page.getByTestId("admin-home-models-grid-Todo-clickable")).toBeVisible({
      timeout: 20_000,
    });
  });
});
