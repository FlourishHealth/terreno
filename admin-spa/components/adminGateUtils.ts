interface IsForbiddenAdminConfigErrorOptions {
  error: unknown;
  isAuthenticated: boolean;
  isConfigLoading: boolean;
  status?: number;
}

export const isForbiddenAdminConfigError = ({
  error,
  isAuthenticated,
  isConfigLoading,
  status,
}: IsForbiddenAdminConfigErrorOptions): boolean => {
  if (!isAuthenticated) {
    return false;
  }
  if (isConfigLoading) {
    return false;
  }
  if (!error) {
    return false;
  }
  return status === 403;
};

/**
 * Screens `AdminGate` may show instead of the wrapped app content. `"app"` means the
 * visitor is a verified admin (the gate still checks `isConfigLoading` separately before
 * rendering children in that case).
 */
export type AdminGateState = "loading" | "setup" | "login" | "forbidden" | "app";

/** The route each non-"loading"/"app" gate state redirects to. */
export const ADMIN_GATE_ROUTES: Record<Exclude<AdminGateState, "loading" | "app">, string> = {
  forbidden: "/forbidden",
  login: "/login",
  setup: "/setup",
};

interface ResolveAdminGateStateOptions {
  isAuthLoading: boolean;
  isSetupStatusLoading: boolean;
  /** True when the backend reports no admin user exists yet. */
  needsSetup: boolean;
  isAuthenticated: boolean;
  isForbidden: boolean;
  status?: number;
}

/**
 * Pure decision function behind `AdminGate`. Priority order matters: the setup flow
 * takes precedence over login (an anonymous visitor sees /setup, not /login, when no
 * admin exists yet), which takes precedence over the forbidden check (which requires an
 * authenticated, non-admin session).
 */
export const resolveAdminGateState = ({
  isAuthLoading,
  isSetupStatusLoading,
  needsSetup,
  isAuthenticated,
  isForbidden,
  status,
}: ResolveAdminGateStateOptions): AdminGateState => {
  if (isAuthLoading || isSetupStatusLoading) {
    return "loading";
  }
  if (needsSetup) {
    return "setup";
  }
  if (!isAuthenticated || status === 401) {
    return "login";
  }
  if (isForbidden) {
    return "forbidden";
  }
  return "app";
};
