/**
 * Credentials accepted by the e2e test server's mock better-auth sign-in endpoint.
 * Kept in a dependency-free module so Playwright specs can import them without
 * pulling the Express server (and its CJS deps) into the test runner.
 */
export const E2E_ADMIN_EMAIL = "admin-e2e@example.com";
export const E2E_ADMIN_PASSWORD = "admin-e2e-password";
