import {describe, expect, it, mock} from "bun:test";

import {openApiCompatMiddleware, patchAppUse} from "./openApiCompat";

describe("patchAppUse", () => {
  it("records trimmed mount path on newly-added layers", () => {
    const app = {
      router: {stack: [{name: "existing-layer"}]},
      use(..._args: unknown[]) {
        this.router.stack.push({name: "new-layer-1"}, {name: "new-layer-2"});
        return "ok";
      },
    };

    patchAppUse(app);
    const result = app.use("/api/v1/", () => {});

    expect(result).toBe("ok");
    expect(app.router.stack[0].__openApiMountPath).toBeUndefined();
    expect(app.router.stack[1].__openApiMountPath).toBe("/api/v1");
    expect(app.router.stack[2].__openApiMountPath).toBe("/api/v1");
  });

  it("does not set mount path for root or non-string mount", () => {
    const app = {
      _router: {stack: [] as Array<Record<string, unknown>>},
      use(..._args: unknown[]) {
        this._router.stack.push({});
        return "ok";
      },
    };

    patchAppUse(app);
    app.use("/", () => {});
    app.use(() => {});

    expect(app._router.stack[0].__openApiMountPath).toBeUndefined();
    expect(app._router.stack[1].__openApiMountPath).toBeUndefined();
  });
});

describe("openApiCompatMiddleware", () => {
  it("patches router layers for openapi compatibility", () => {
    const stack: any[] = [
      {keys: [], slash: true},
      {
        __openApiMountPath: "/admin",
        handle: {stack: [{keys: ["childId"], path: "/child/:childId"}]},
        keys: ["legacyParam"],
        name: "router",
      },
      {keys: [], path: "/foods/:foodId/:optionalId?"},
      {route: {path: "/reports/:reportId", stack: [{keys: [], path: "/items/:itemId"}]}},
      {regexp: /already-set/, route: {path: "/ignored/:id"}},
      {},
    ];

    const req = {app: {router: {stack}}};
    const next = mock(() => {});

    openApiCompatMiddleware(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);

    expect(stack[0].regexp).toEqual({fast_slash: true});
    expect(stack[0].keys).toEqual([]);

    expect(stack[1].regexp).toBeInstanceOf(RegExp);
    expect(stack[1].regexp.test("/admin/users")).toBeTrue();
    expect(stack[1].keys).toEqual([{name: "legacyParam", optional: false}]);
    expect(stack[1].handle.stack[0].regexp).toBeInstanceOf(RegExp);
    expect(stack[1].handle.stack[0].keys).toEqual([{name: "childId", optional: false}]);

    expect(stack[2].regexp).toBeInstanceOf(RegExp);
    expect(stack[2].regexp.test("/foods/123/456")).toBeTrue();
    expect(stack[2].keys).toEqual([
      {name: "foodId", optional: false},
      {name: "optionalId", optional: true},
    ]);

    expect(stack[3].regexp).toBeInstanceOf(RegExp);
    expect(stack[3].keys).toEqual([{name: "reportId", optional: false}]);
    expect(stack[3].route.stack[0].keys).toEqual([{name: "itemId", optional: false}]);

    expect(stack[4].regexp).toEqual(/already-set/);

    expect(stack[5].regexp).toEqual(/^\/?$/);
    expect(stack[5].keys).toEqual([]);
  });

  it("uses app._router when available", () => {
    const req = {app: {_router: {stack: [{keys: [], path: "/users/:userId"}]}}};
    const next = mock(() => {});

    openApiCompatMiddleware(req, {}, next);

    expect(req.app._router.stack[0].regexp).toBeInstanceOf(RegExp);
    expect(req.app._router.stack[0].keys).toEqual([{name: "userId", optional: false}]);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
