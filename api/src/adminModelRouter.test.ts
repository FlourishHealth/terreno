import {describe, expect, it, mock} from "bun:test";
import type express from "express";
import {model, Schema} from "mongoose";

import {enrichModelRouterOptions} from "./adminModelRouter";
import type {AdminChangeEvent, AdminConfig} from "./adminTypes";
import type {ModelRouterOptions} from "./api";
import type {TerrenoApp} from "./terrenoApp";

interface WidgetShape {
  internalNote?: string;
  secret?: string;
  title?: string;
}

const widgetSchema = new Schema({
  internalNote: String,
  secret: String,
  title: String,
});

const Widget = model("AdminRouterWidget", widgetSchema);

const admin: AdminConfig = {
  displayName: "Widgets",
  excludeFields: ["secret"],
  hiddenFields: ["internalNote"],
  listFields: ["title"],
  readonlyFields: ["title"],
};

const makeRequest = (user?: {_id?: string; id?: string}): express.Request => {
  return {user} as unknown as express.Request;
};

const makeTerrenoApp = (): {
  emitted: AdminChangeEvent[];
  terrenoApp: TerrenoApp;
} => {
  const emitted: AdminChangeEvent[] = [];
  const terrenoApp = {
    emitAdminModelChanged: (event: AdminChangeEvent) => {
      emitted.push(event);
    },
  } as unknown as TerrenoApp;
  return {emitted, terrenoApp};
};

describe("enrichModelRouterOptions", () => {
  describe("without admin config", () => {
    it("returns the options unchanged when no context openApi is provided", () => {
      const options: ModelRouterOptions<WidgetShape> = {permissions: {}};
      const result = enrichModelRouterOptions(Widget, options, {});
      expect(result).toBe(options);
    });

    it("merges context openApi into the options", () => {
      const openApi = {} as NonNullable<ModelRouterOptions<WidgetShape>["openApi"]>;
      const options: ModelRouterOptions<WidgetShape> = {permissions: {}};
      const result = enrichModelRouterOptions(Widget, options, {openApi});
      expect(result).not.toBe(options);
      expect(result.openApi).toBe(openApi);
    });
  });

  describe("body stripping hooks", () => {
    it("preCreate strips readonly, excluded, and hidden fields", async () => {
      const options: ModelRouterOptions<WidgetShape> = {admin, permissions: {}};
      const enriched = enrichModelRouterOptions(Widget, options, {});
      const body = await enriched.preCreate?.(
        {internalNote: "n", secret: "s", title: "t"},
        makeRequest()
      );
      expect(body).toEqual({});
    });

    it("preCreate chains into the user preCreate hook", async () => {
      const userPreCreate = mock((value: unknown) => ({
        ...(value as Record<string, unknown>),
        title: "from-user",
      }));
      const options: ModelRouterOptions<WidgetShape> = {
        admin,
        permissions: {},
        preCreate: userPreCreate as unknown as ModelRouterOptions<WidgetShape>["preCreate"],
      };
      const enriched = enrichModelRouterOptions(Widget, options, {});
      const body = await enriched.preCreate?.({secret: "s", title: "t"}, makeRequest());
      expect(userPreCreate).toHaveBeenCalledTimes(1);
      expect(body).toEqual({title: "from-user"});
    });

    it("preUpdate strips fields and returns the body without a user hook", async () => {
      const options: ModelRouterOptions<WidgetShape> = {admin, permissions: {}};
      const enriched = enrichModelRouterOptions(Widget, options, {});
      const body = await enriched.preUpdate?.({secret: "s", title: "t"}, makeRequest());
      expect(body).toEqual({});
    });

    it("preUpdate returns null when the user hook returns null", async () => {
      const options: ModelRouterOptions<WidgetShape> = {
        admin,
        permissions: {},
        preUpdate: () => null,
      };
      const enriched = enrichModelRouterOptions(Widget, options, {});
      const body = await enriched.preUpdate?.({title: "t"}, makeRequest());
      expect(body).toBeNull();
    });

    it("preUpdate chains into the user preUpdate hook", async () => {
      const options: ModelRouterOptions<WidgetShape> = {
        admin,
        permissions: {},
        preUpdate: (value) => ({...value, internalNote: "kept"}) as WidgetShape,
      };
      const enriched = enrichModelRouterOptions(Widget, options, {});
      const body = await enriched.preUpdate?.({secret: "s"}, makeRequest());
      expect(body).toEqual({internalNote: "kept"});
    });
  });

  describe("realtime emits", () => {
    const realtimeAdmin: AdminConfig = {...admin, realtime: true};

    it("emits a scrubbed create event", async () => {
      const {emitted, terrenoApp} = makeTerrenoApp();
      const options: ModelRouterOptions<WidgetShape> = {admin: realtimeAdmin, permissions: {}};
      const enriched = enrichModelRouterOptions(Widget, options, {
        routePath: "/widgets",
        terrenoApp,
      });
      const doc = new Widget({internalNote: "n", secret: "s", title: "t"});
      await enriched.postCreate?.(doc, makeRequest({_id: "user1"}));
      expect(emitted).toHaveLength(1);
      expect(emitted[0].type).toBe("create");
      expect(emitted[0].modelName).toBe("AdminRouterWidget");
      expect(emitted[0].routePath).toBe("/widgets");
      expect(emitted[0].user).toEqual({id: "user1"});
      const document = emitted[0].document as Record<string, unknown>;
      expect(document.title).toBe("t");
      expect(document.secret).toBeUndefined();
      expect(document.internalNote).toBeUndefined();
    });

    it("emits an update event and calls the user postUpdate hook", async () => {
      const {emitted, terrenoApp} = makeTerrenoApp();
      const userPostUpdate = mock(async () => {});
      const options: ModelRouterOptions<WidgetShape> = {
        admin: realtimeAdmin,
        permissions: {},
        postUpdate: userPostUpdate,
      };
      const enriched = enrichModelRouterOptions(Widget, options, {
        routePath: "/widgets",
        terrenoApp,
      });
      const doc = new Widget({title: "t"});
      const prev = new Widget({title: "old"});
      await enriched.postUpdate?.(doc, {title: "t"}, makeRequest({id: "user2"}), prev);
      expect(userPostUpdate).toHaveBeenCalledTimes(1);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].type).toBe("update");
      expect(emitted[0].user).toEqual({id: "user2"});
    });

    it("emits a delete event without a document payload", async () => {
      const {emitted, terrenoApp} = makeTerrenoApp();
      const userPostDelete = mock(async () => {});
      const options: ModelRouterOptions<WidgetShape> = {
        admin: realtimeAdmin,
        permissions: {},
        postDelete: userPostDelete,
      };
      const enriched = enrichModelRouterOptions(Widget, options, {
        routePath: "/widgets",
        terrenoApp,
      });
      const doc = new Widget({title: "t"});
      await enriched.postDelete?.(makeRequest({_id: "user3"}), doc);
      expect(userPostDelete).toHaveBeenCalledTimes(1);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].type).toBe("delete");
      expect(emitted[0].document).toBeUndefined();
      expect(emitted[0].documentId).toBe(String(doc._id));
    });

    it("does not emit when the request has no user", async () => {
      const {emitted, terrenoApp} = makeTerrenoApp();
      const options: ModelRouterOptions<WidgetShape> = {admin: realtimeAdmin, permissions: {}};
      const enriched = enrichModelRouterOptions(Widget, options, {
        routePath: "/widgets",
        terrenoApp,
      });
      await enriched.postCreate?.(new Widget({title: "t"}), makeRequest());
      expect(emitted).toHaveLength(0);
    });

    it("does not emit when realtime is disabled but still calls user hooks", async () => {
      const {emitted, terrenoApp} = makeTerrenoApp();
      const userPostCreate = mock(async () => {});
      const options: ModelRouterOptions<WidgetShape> = {
        admin,
        permissions: {},
        postCreate: userPostCreate,
      };
      const enriched = enrichModelRouterOptions(Widget, options, {
        routePath: "/widgets",
        terrenoApp,
      });
      await enriched.postCreate?.(new Widget({title: "t"}), makeRequest({_id: "user4"}));
      expect(userPostCreate).toHaveBeenCalledTimes(1);
      expect(emitted).toHaveLength(0);
    });

    it("does not emit when the terrenoApp context is missing", async () => {
      const {emitted} = makeTerrenoApp();
      const options: ModelRouterOptions<WidgetShape> = {admin: realtimeAdmin, permissions: {}};
      const enriched = enrichModelRouterOptions(Widget, options, {routePath: "/widgets"});
      await enriched.postCreate?.(new Widget({title: "t"}), makeRequest({_id: "user5"}));
      await enriched.postUpdate?.(
        new Widget({title: "t"}),
        {},
        makeRequest({_id: "user5"}),
        new Widget({title: "old"})
      );
      await enriched.postDelete?.(makeRequest({_id: "user5"}), new Widget({title: "t"}));
      expect(emitted).toHaveLength(0);
    });
  });
});
