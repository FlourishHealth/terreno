/**
 * Runtime configuration for the standalone admin SPA.
 *
 * Served by {@link AdminSpaServeApp} at `${basePath}/app-config.json` and fetched
 * by the SPA on boot. This lets a single pre-built bundle be themed and pointed at
 * the right auth/admin API paths per consumer without rebuilding.
 */
export interface AdminSpaAppConfig {
  /** Brand name shown in the header. Default: "Terreno Admin". */
  brandName: string;
  /** Logo asset URL (absolute or relative). Optional. */
  logoUrl?: string;
  /** Primary brand color (hex). Default: "#2563EB". */
  primaryColor: string;
  /** Enabled login providers. Drives login screen rendering. Default: ["email"]. */
  providers: ReadonlyArray<"email" | "google" | "github" | "apple">;
  /** Base path of the better-auth routes on this same origin. Default: "/api/auth". */
  authBasePath?: string;
  /** Base path of the admin API on this same origin. Default: "/admin". */
  adminApiBasePath?: string;
}

/**
 * Default app-config values. Merged field-by-field with consumer-provided overrides
 * so a partial `appConfig` only changes the fields it specifies.
 */
export const DEFAULT_APP_CONFIG: AdminSpaAppConfig = {
  adminApiBasePath: "/admin",
  authBasePath: "/api/auth",
  brandName: "Terreno Admin",
  primaryColor: "#2563EB",
  providers: ["email"],
};

/** Merge consumer overrides over the defaults, returning a complete config. */
export const resolveAppConfig = (overrides?: Partial<AdminSpaAppConfig>): AdminSpaAppConfig => {
  return {...DEFAULT_APP_CONFIG, ...overrides};
};
