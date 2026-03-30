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

const MOUNT_PATH_KEY = "__openApiMountPath";

/**
 * Extract Express 4-style keys from a path string.
 * Parses `:paramName` and `*paramName` segments into `{name, optional}` objects
 * that @wesleytodd/openapi expects.
 */
const extractKeysFromPath = (path: string): Array<{name: string; optional: boolean}> => {
  const keys: Array<{name: string; optional: boolean}> = [];
  const paramRegex = /[:*](\w+)\??/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((match = paramRegex.exec(path)) !== null) {
    keys.push({name: match[1], optional: match[0].endsWith("?")});
  }
  return keys;
};

/**
 * Build an Express 4-style regexp from a path string for the openapi parser.
 *
 * For paths without params (e.g., `/food`), produces a simple escaped regexp
 * that the `split()` function in @wesleytodd/openapi can parse directly.
 *
 * For paths with `:params` (e.g., `/food/:id`), replaces each param with the
 * Express 4-style capture group `(?:([^\/]+?))` so that `processComplexMatch()`
 * in the openapi library can map them to `{paramName}` using `layer.keys`.
 */
const buildRegexpForPath = (pathStr: string, isMount: boolean): RegExp => {
  // Replace :param segments with Express 4-style capture groups, then escape the rest
  const parts = pathStr.split("/").map((segment) => {
    if (segment.startsWith(":")) {
      return "(?:([^\\/]+?))";
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  const pattern = parts.join("\\/");
  if (isMount) {
    return new RegExp(`^${pattern}\\/?(?=\\/|$)`);
  }
  return new RegExp(`^${pattern}\\/?$`);
};

const patchRouterStack = (stack: any[]): void => {
  for (const layer of stack) {
    if (layer.regexp !== undefined) {
      continue;
    }

    // Determine the path string for this layer
    let pathStr: string | undefined;
    const isMount = layer.name === "router" || !!layer.handle?.stack;

    if (layer.slash) {
      // Express 5 layers use .slash instead of .regexp.fast_slash
      layer.regexp = {fast_slash: true};
    } else if (layer[MOUNT_PATH_KEY]) {
      pathStr = layer[MOUNT_PATH_KEY] as string;
      layer.regexp = buildRegexpForPath(pathStr, isMount);
    } else if (layer.path && typeof layer.path === "string") {
      pathStr = layer.path as string;
      layer.regexp = buildRegexpForPath(pathStr, false);
    } else if (layer.route?.path && typeof layer.route.path === "string") {
      pathStr = layer.route.path as string;
      layer.regexp = buildRegexpForPath(pathStr, false);
    } else {
      layer.regexp = /^\/?$/;
    }

    // Populate keys in Express 4 format: [{name, optional}]
    // @wesleytodd/openapi reads layer.keys[i].name for path parameters
    if (!layer.keys || (Array.isArray(layer.keys) && layer.keys.length === 0)) {
      if (pathStr) {
        layer.keys = extractKeysFromPath(pathStr);
      } else {
        layer.keys = [];
      }
    } else if (Array.isArray(layer.keys) && typeof layer.keys[0] === "string") {
      // Express 5 stores keys as plain strings after match() — convert to objects
      layer.keys = layer.keys.map((k: string) => ({name: k, optional: false}));
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
 * Wraps an Express app's `use` method to record the mount path on each
 * layer added to the router stack. This runs at setup time so that
 * `patchRouterStack` can read the original path later.
 *
 * Must be called before any routes are registered.
 */
export const patchAppUse = (app: any): void => {
  const originalUse = app.use.bind(app);
  app.use = function patchedUse(...args: any[]) {
    // Track stack length before the call
    const stackBefore = app._router?.stack?.length ?? 0;

    const result = originalUse(...args);

    // After use(), check if new layers were added and annotate them
    if (app._router?.stack) {
      const routerAfter = app._router;
      const stackAfter = routerAfter.stack.length;
      // The first arg is the mount path if it's a string
      const mountPath = typeof args[0] === "string" ? args[0] : undefined;
      if (mountPath && mountPath !== "/") {
        for (let i = stackBefore; i < stackAfter; i++) {
          routerAfter.stack[i][MOUNT_PATH_KEY] = mountPath.replace(/\/+$/, "");
        }
      }
    }

    return result;
  };
};

/**
 * Express middleware that patches the router stack before OpenAPI doc
 * generation. Must be mounted before the openapi middleware.
 */
export const openApiCompatMiddleware = (req: any, _res: any, next: () => void): void => {
  const router = req.app._router;
  if (router?.stack) {
    patchRouterStack(router.stack);
  }
  next();
};
