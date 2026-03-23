import type express from "express";

/**
 * Interface for plugins that can be registered with TerrenoApp.
 *
 * Implement this interface to create reusable plugins that encapsulate
 * routes, middleware, or other Express application setup. Plugins are
 * registered via `TerrenoApp.register()` and are mounted after core
 * authentication and OpenAPI middleware.
 *
 * @example
 * ```typescript
 * class MyPlugin implements TerrenoPlugin {
 *   register(app: express.Application): void {
 *     app.get("/my-route", (req, res) => {
 *       res.json({ status: "ok" });
 *     });
 *   }
 * }
 *
 * const app = new TerrenoApp({ userModel: User })
 *   .register(new MyPlugin())
 *   .start();
 * ```
 *
 * @see TerrenoApp for the application builder that consumes plugins
 * @see HealthApp for a built-in plugin example
 */
export interface TerrenoPlugin {
  /**
   * Register routes and middleware with the Express application.
   *
   * Called during `TerrenoApp.build()` after core middleware has been
   * configured but before error handling middleware is added.
   *
   * @param app - The Express application instance to register with
   */
  register(app: express.Application): void;
}
