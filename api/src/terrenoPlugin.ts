import type http from "node:http";
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

  /**
   * Called after the HTTP server is created but before it starts listening.
   * Use this to attach services that need the raw HTTP server, such as
   * Socket.io or other WebSocket libraries.
   *
   * Only called when using `TerrenoApp.start()` (not `build()`).
   *
   * @param server - The Node.js HTTP server instance
   */
  onServerCreated?(server: http.Server): void;
}
