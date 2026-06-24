/** Minimal auth env validation for backend tests (mirrors @terreno/api setupEnvironment). */
export const setupTestEnvironment = (): void => {
  if (!process.env.TOKEN_ISSUER) {
    throw new Error("TOKEN_ISSUER must be set in env.");
  }
  if (!process.env.TOKEN_SECRET) {
    throw new Error("TOKEN_SECRET must be set.");
  }
  if (!process.env.REFRESH_TOKEN_SECRET) {
    throw new Error("REFRESH_TOKEN_SECRET must be set.");
  }
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set.");
  }
};
