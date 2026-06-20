import {expect, test} from "@playwright/test";

// Must match the credentials seeded by example-backend/src/scripts/seed-admin-spa-admin.ts.
const ADMIN_EMAIL = process.env.ADMIN_SPA_E2E_EMAIL ?? "admin-spa-e2e@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_SPA_E2E_PASSWORD ?? "admin-spa-e2e-password";

/**
 * Full-stack integration tests: the pre-built admin SPA is served by a real
 * example-backend (AdminSpaServeApp at /console) with Better Auth and the admin API
 * on the same origin. Exercises the serve plugin, app-config, Better Auth email
 * sign-in, the AdminGate authorization check, and the admin home end-to-end.
 */
test.describe("admin SPA served by example-backend", () => {
  test("anonymous visitor is redirected to the backend-configured login screen", async ({page}) => {
    await page.goto("/console/");

    await page.waitForURL(/\/console\/login/, {timeout: 30_000});
    // Brand name comes from the example-backend's AdminSpaServeApp appConfig.
    await expect(page.getByText("Terreno Example")).toBeVisible();
    await expect(page.getByTestId("admin-spa-login-email")).toBeVisible();
  });

  test("admin signs in with Better Auth and sees the admin home", async ({page}) => {
    await page.goto("/console/login");
    await expect(page.getByTestId("admin-spa-login-email")).toBeVisible();

    await page.getByTestId("admin-spa-login-email").fill(ADMIN_EMAIL);
    await page.getByTestId("admin-spa-login-password").fill(ADMIN_PASSWORD);
    await page.getByTestId("admin-spa-login-submit").click();

    // Successful sign-in routes back to the SPA root, which renders AdminHome
    // from the backend's /admin/config (only reachable as an admin).
    await page.waitForURL(/\/console\/?$/, {timeout: 30_000});
    await expect(page.getByTestId("admin-home-model-stat-Todo")).toBeVisible({timeout: 30_000});
    await expect(page.getByTestId("admin-home-model-stat-User")).toBeVisible();
  });
});
