/**
 * Credentials accepted by the e2e test server's mock better-auth sign-in endpoint.
 * Kept in a dependency-free module so Playwright specs can import them without
 * pulling the Express server (and its CJS deps) into the test runner.
 */
export const E2E_ADMIN_EMAIL = "admin-e2e@example.com";
export const E2E_ADMIN_PASSWORD = "admin-e2e-password";

/**
 * Cookie a spec sets on its browser context to make the mock server's
 * `/admin/setup-status` report `needsSetup: true` for that context only. Scoping via a
 * per-context cookie (rather than shared server state) keeps the first-admin-setup specs
 * safe to run in parallel with the rest of the suite against the same webServer.
 */
export const E2E_NEEDS_SETUP_COOKIE = "admin_spa_e2e_needs_setup";
