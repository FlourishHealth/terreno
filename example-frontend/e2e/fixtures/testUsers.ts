export const TEST_USER = {
  email: "e2e-test@terreno.dev",
  name: "E2E Test User",
  password: "TestPassword123!",
};

export const ADMIN_USER = {
  email: "e2e-admin@terreno.dev",
  name: "E2E Admin User",
  password: "AdminPassword123!",
};

/**
 * Second non-admin user used by realtime tests to verify owner-strategy isolation —
 * realtime events for one user's documents must not reach another user's socket.
 */
export const SECOND_USER = {
  email: "e2e-second@terreno.dev",
  name: "E2E Second User",
  password: "SecondPassword123!",
};
