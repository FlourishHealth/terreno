/**
 * Detect a 403 from GET /admin/config. That is the single admin-page gate:
 * `admin:access` when RBAC is on, otherwise `user.admin`.
 */
export const isAdminPageForbiddenError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const withStatus = error as {originalStatus?: unknown; status?: unknown};
  if (withStatus.status === 403 || withStatus.originalStatus === 403) {
    return true;
  }
  const nested = withStatus.status;
  if (nested && typeof nested === "object" && "status" in nested) {
    return (nested as {status?: unknown}).status === 403;
  }
  return false;
};
