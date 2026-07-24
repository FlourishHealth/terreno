import {describe, expect, it} from "bun:test";
import express, {type Application, type Request, type Response} from "express";
import supertest from "supertest";

import {openApiCompatMiddleware, patchAppUse} from "../openApiCompat";

interface PatchedLayer {
  name?: string;
  regexp?: {fast_slash?: boolean} | RegExp;
  slash?: boolean;
  path?: string;
  route?: {path?: string; stack?: PatchedLayer[]};
  handle?: {stack?: PatchedLayer[]};
  keys?: Array<{name: string; optional: boolean}> | string[];
  __openApiMountPath?: string;
}

interface AppWithRouter {
  _router?: {stack: PatchedLayer[]};
  router?: {stack: PatchedLayer[]};
}

const getRouterStack = (app: Application): PatchedLayer[] => {
  const internal = app as unknown as AppWithRouter;
  const router = internal._router ?? internal.router;
  if (!router) {
    throw new Error("Express app has no router");
  }
  return router.stack as PatchedLayer[];
};

const findLayer = (
  stack: PatchedLayer[],
  predicate: (layer: PatchedLayer) => boolean
): PatchedLayer | undefined => {
  for (const layer of stack) {
    if (predicate(layer)) {
      return layer;
    }
    if (layer.handle?.stack) {
      const nested = findLayer(layer.handle.stack, predicate);
      if (nested) {
        return nested;
      }
    }
    if (layer.route?.stack) {
      const nested = findLayer(layer.route.stack, predicate);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
};

const runMiddleware = (app: Application): void => {
  const middlewareReq = {app} as unknown as Request;
  const middlewareRes = {} as Response;
  let called = false;
  openApiCompatMiddleware(middlewareReq, middlewareRes, () => {
    called = true;
  });
  if (!called) {
    throw new Error("next() was not called by openApiCompatMiddleware");
  }
};

describe("openApiCompat", () => {
  describe("patchAppUse", () => {
    it("annotates layers added via app.use(mountPath, ...) with the mount path", () => {
      const app = express();
      patchAppUse(app);

      const subRouter = express.Router();
      subRouter.get("/list", (_req, res) => {
        res.json({ok: true});
      });
      app.use("/sub", subRouter);

      const stack = getRouterStack(app);
      const mountedLayer = stack.find((layer) => layer.__openApiMountPath !== undefined) as
        | PatchedLayer
        | undefined;
      expect(mountedLayer).toBeDefined();
      expect(mountedLayer?.__openApiMountPath).toBe("/sub");
    });

    it("strips trailing slashes from the recorded mount path", () => {
      const app = express();
      patchAppUse(app);

      const subRouter = express.Router();
      subRouter.get("/", (_req, res) => {
        res.send("ok");
      });
      app.use("/api/v1///", subRouter);

      const stack = getRouterStack(app);
      const mountedLayer = stack.find((layer) => layer.__openApiMountPath !== undefined) as
        | PatchedLayer
        | undefined;
      expect(mountedLayer?.__openApiMountPath).toBe("/api/v1");
    });

    it("does not annotate layers when mount path is missing or '/'", () => {
      const app = express();
      patchAppUse(app);

      app.use((_req, _res, next) => next());

      const subRouter = express.Router();
      subRouter.get("/x", (_req, res) => res.send("x"));
      app.use("/", subRouter);

      const stack = getRouterStack(app);
      for (const layer of stack) {
        expect(layer.__openApiMountPath).toBeUndefined();
      }
    });

    it("returns the underlying use() return value", () => {
      const app = express();
      patchAppUse(app);
      const result = app.use((_req, _res, next) => next());
      expect(result).toBe(app);
    });
  });

  describe("openApiCompatMiddleware", () => {
    it("calls next() and is a no-op when the app has no router yet", () => {
      const fakeReq = {app: {}} as unknown as Request;
      const fakeRes = {} as Response;
      let nextCalled = false;
      openApiCompatMiddleware(fakeReq, fakeRes, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    });

    it("sets fast_slash regexp on layers that use Express 5 .slash", () => {
      const app = express();
      patchAppUse(app);
      app.use((_req, _res, next) => next());

      const stack = getRouterStack(app);
      const slashLayer = stack.find((layer) => layer.slash === true) as PatchedLayer | undefined;
      expect(slashLayer).toBeDefined();

      runMiddleware(app);

      const patchedRegexp = slashLayer?.regexp as {fast_slash?: boolean} | undefined;
      expect(patchedRegexp?.fast_slash).toBe(true);
    });

    it("builds a regexp for sub-routers mounted at a non-root path", () => {
      const app = express();
      patchAppUse(app);

      const subRouter = express.Router();
      subRouter.get("/foo", (_req, res) => res.send("foo"));
      app.use("/sub", subRouter);

      runMiddleware(app);

      const stack = getRouterStack(app);
      const subLayer = stack.find((layer) => layer.__openApiMountPath === "/sub") as
        | PatchedLayer
        | undefined;
      expect(subLayer).toBeDefined();
      const regexp = subLayer?.regexp as RegExp;
      expect(regexp).toBeInstanceOf(RegExp);
      expect(regexp.test("/sub/foo")).toBe(true);
    });

    it("builds a regexp from layer.path and extracts :param keys", () => {
      const app = express();
      patchAppUse(app);

      const stack = getRouterStack(app);
      stack.push({
        name: "boundDispatch",
        path: "/users/:userId",
      } as PatchedLayer);

      runMiddleware(app);

      const inserted = stack[stack.length - 1];
      expect(inserted.regexp).toBeInstanceOf(RegExp);
      expect((inserted.regexp as RegExp).test("/users/abc")).toBe(true);
      expect(inserted.keys).toEqual([{name: "userId", optional: false}]);
    });

    it("builds a regexp from route.path for plain route layers", async () => {
      const app = express();
      patchAppUse(app);
      app.get("/items/:itemId", (_req, res) => {
        res.json({ok: true});
      });

      runMiddleware(app);

      const stack = getRouterStack(app);
      const routeLayer = findLayer(stack, (layer) => layer.route?.path === "/items/:itemId");
      expect(routeLayer).toBeDefined();
      expect(routeLayer?.regexp).toBeInstanceOf(RegExp);
      if (!(routeLayer?.regexp instanceof RegExp)) {
        throw new Error("Expected the item route layer to have a regexp");
      }
      expect(routeLayer.regexp.test("/items/123")).toBe(true);
      expect(routeLayer?.keys).toEqual([{name: "itemId", optional: false}]);

      const res = await supertest(app).get("/items/123").expect(200);
      expect(res.body).toEqual({ok: true});
    });

    it("falls back to /^\\/?$/ when no path information is available", () => {
      const app = express();
      patchAppUse(app);
      const stack = getRouterStack(app);
      stack.push({name: "anonymous"} as PatchedLayer);

      runMiddleware(app);

      const inserted = stack[stack.length - 1];
      expect(inserted.regexp).toBeInstanceOf(RegExp);
      expect((inserted.regexp as RegExp).source).toBe("^\\/?$");
      expect(inserted.keys).toEqual([]);
    });

    it("skips layers that already have a regexp set", () => {
      const app = express();
      patchAppUse(app);
      const stack = getRouterStack(app);
      const existing = /^prebuilt$/;
      stack.push({
        name: "preset",
        path: "/should-be-ignored/:id",
        regexp: existing,
      } as PatchedLayer);

      runMiddleware(app);

      const inserted = stack[stack.length - 1];
      expect(inserted.regexp).toBe(existing);
      expect(inserted.keys).toBeUndefined();
    });

    it("converts Express 5 string keys arrays into {name, optional} objects", () => {
      const app = express();
      patchAppUse(app);
      const stack = getRouterStack(app);
      stack.push({
        keys: ["userId", "postId"],
        name: "boundDispatch",
        path: "/users/:userId/posts/:postId",
      } as PatchedLayer);

      runMiddleware(app);

      const inserted = stack[stack.length - 1];
      expect(inserted.keys).toEqual([
        {name: "userId", optional: false},
        {name: "postId", optional: false},
      ]);
    });

    it("recurses into nested router stacks added via patchAppUse", () => {
      const app = express();
      patchAppUse(app);

      const inner = express.Router();
      inner.get("/widgets/:widgetId", (_req, res) => res.send("widget"));
      app.use("/api", inner);

      runMiddleware(app);

      const stack = getRouterStack(app);
      const widgetLayer = findLayer(stack, (layer) => layer.route?.path === "/widgets/:widgetId");
      expect(widgetLayer).toBeDefined();
      expect(widgetLayer?.regexp).toBeInstanceOf(RegExp);
      if (!(widgetLayer?.regexp instanceof RegExp)) {
        throw new Error("Expected the widget route layer to have a regexp");
      }
      expect(widgetLayer.regexp.test("/widgets/42")).toBe(true);
      expect(widgetLayer?.keys).toEqual([{name: "widgetId", optional: false}]);
    });

    it("escapes regex metacharacters in static path segments", () => {
      const app = express();
      patchAppUse(app);
      const stack = getRouterStack(app);
      stack.push({
        name: "boundDispatch",
        path: "/foo.bar/baz",
      } as PatchedLayer);

      runMiddleware(app);

      const inserted = stack[stack.length - 1];
      const regexp = inserted.regexp as RegExp;
      expect(regexp.test("/foo.bar/baz")).toBe(true);
      expect(regexp.test("/fooXbar/baz")).toBe(false);
    });
  });
});
