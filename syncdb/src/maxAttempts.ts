/**
 * Map the codegen/factory `retries` option onto `MutateArgs.maxAttempts`.
 * `false` → 1 attempt (fail fast); a number → that many error-nack attempts;
 * omitted/`true` → engine default (`MAX_ERROR_NACK_ATTEMPTS`).
 */
export const retriesToMaxAttempts = (retries?: boolean | number): number | undefined => {
  if (retries === false) {
    return 1;
  }
  if (typeof retries === "number") {
    return retries;
  }
  return undefined;
};
