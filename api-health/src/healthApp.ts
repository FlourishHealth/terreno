import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

/**
 * Result of a health check operation.
 */
export interface HealthCheckResult {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Optional additional details about the health status */
  details?: Record<string, any>;
}

/**
 * Configuration options for the health check endpoint.
 */
export interface HealthOptions {
  /** Whether the health endpoint is enabled (default: true) */
  enabled?: boolean;
  /** Path for the health endpoint (default: "/health") */
  path?: string;
  /** Optional custom health check function. If not provided, always returns healthy. */
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

/**
 * TerrenoPlugin that provides a health check endpoint.
 *
 * Registers a GET endpoint (default: `/health`) that returns the health
 * status of the application. Supports custom health check logic via the
 * `check` option for more complex health monitoring.
 *
 * @example
 * ```typescript
 * // Simple health check (always healthy)
 * const app = new TerrenoApp({ userModel: User })
 *   .register(new HealthApp())
 *   .start();
 *
 * // Custom health check with database connection test
 * const healthApp = new HealthApp({
 *   path: "/api/health",
 *   check: async () => {
 *     try {
 *       await mongoose.connection.db.admin().ping();
 *       return { healthy: true, details: { database: "connected" } };
 *     } catch (error) {
 *       return { healthy: false, details: { database: "disconnected" } };
 *     }
 *   },
 * });
 *
 * const app = new TerrenoApp({ userModel: User })
 *   .register(healthApp)
 *   .start();
 * ```
 *
 * @see TerrenoPlugin for the plugin interface
 * @see TerrenoApp for the application builder
 */
export class HealthApp implements TerrenoPlugin {
  private options: HealthOptions;

  /**
   * Create a new HealthApp plugin.
   *
   * @param options - Health check configuration options
   */
  constructor(options?: HealthOptions) {
    this.options = options ?? {};
  }

  /**
   * Register the health check endpoint with the Express application.
   *
   * Creates a GET endpoint at the configured path (default: `/health`)
   * that returns a JSON response with health status. If a custom check
   * function is provided, it will be called to determine health status.
   * Returns 200 for healthy, 503 for unhealthy.
   *
   * @param app - The Express application instance to register with
   */
  register(app: express.Application): void {
    if (this.options.enabled === false) {
      return;
    }
    const path = this.options.path ?? "/health";
    const checkFn = this.options.check;

    app.get(path, async (_req, res) => {
      if (checkFn) {
        try {
          const result = await checkFn();
          const status = result.healthy ? 200 : 503;
          return res.status(status).json(result);
        } catch (error) {
          return res.status(503).json({
            details: {error: (error as Error).message},
            healthy: false,
          });
        }
      }
      return res.json({healthy: true});
    });
  }
}
