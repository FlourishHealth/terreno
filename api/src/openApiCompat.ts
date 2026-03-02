/**
 * Patches the Express router stack to add `.regexp` on layers for
 * compatibility with @wesleytodd/openapi, which expects Express 4-style
 * layers with `.regexp.fast_slash`.
 *
 * In Express 5 (router@2.x), layers use `.slash` (boolean) and `.matchers`
 * (array of functions) instead of `.regexp`.
 *
 * @see https://github.com/wesleytodd/express-openapi/issues/70
 */

const patchRouterStack = (stack: any[]): void => {
  for (const layer of stack) {
    if (layer.regexp !== undefined) {
      continue;
    }

    // Express 5 layers use .slash instead of .regexp.fast_slash
    if (layer.slash) {
      layer.regexp = {fast_slash: true};
    } else if (layer.path) {
      // Build a simple regexp from the string path for the openapi parser
      const escaped = String(layer.path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      layer.regexp = new RegExp(`^\\/${escaped}\\/?$`);
    } else {
      layer.regexp = /^\/?$/;
    }

    if (!layer.keys) {
      layer.keys = [];
    }

    // Recursively patch nested stacks
    if (layer.handle?.stack) {
      patchRouterStack(layer.handle.stack);
    }
    if (layer.route?.stack) {
      patchRouterStack(layer.route.stack);
    }
  }
};

/**
 * Express middleware that patches the router stack before OpenAPI doc
 * generation. Must be mounted before the openapi middleware.
 */
export const openApiCompatMiddleware = (req: any, _res: any, next: () => void): void => {
  const router = req.app._router || req.app.router;
  if (router?.stack) {
    patchRouterStack(router.stack);
  }
  next();
};
