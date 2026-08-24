import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import type express from "express";
import {model, Schema} from "mongoose";

import {enrichModelRouterOptions} from "./adminModelRouter";
import type {AdminChangeEvent, AdminConfig} from "./adminTypes";
import type {ModelRouterOptions} from "./api";
import type {TerrenoApp} from "./terrenoApp";

interface NoteFields {
  internalNote?: string;
  secret?: string;
  title?: string;
}

const noteSchema = new Schema({
  internalNote: String,
  secret: String,
  title: String,
});

const Note = model<NoteFields>("AdminRouterNote", noteSchema);

const admin: AdminConfig = {
  displayName: "Notes",
  excludeFields: ["secret"],
  hiddenFields: ["internalNote"],
  listFields: ["title"],
  readonlyFields: ["title"],
};

const request = (userId?: string): express.Request =>
  ({user: userId ? {_id: userId} : undefined}) as unknown as express.Request;

const doc = (fields: NoteFields & {_id: string}) => fields as unknown as NoteFields;

describe("enrichModelRouterOptions", () => {
  let events: AdminChangeEvent[];
  let terrenoApp: TerrenoApp;

  beforeEach(() => {
    events = [];
    terrenoApp = {
      emitAdminModelChanged: (event: AdminChangeEvent) => {
        events.push(event);
      },
    } as unknown as TerrenoApp;
  });

  describe("without an admin config", () => {
    it("returns the original options untouched", () => {
      const options: ModelRouterOptions<NoteFields> = {sort: "-created"};
      assert.strictEqual(enrichModelRouterOptions(Note, options, {}), options);
    });

    it("applies the context openApi options without wrapping hooks", () => {
      const options: ModelRouterOptions<NoteFields> = {sort: "-created"};
      const openApi = {tags: ["notes"]};
      const result = enrichModelRouterOptions(Note, options, {openApi});
      assert.notStrictEqual(result, options);
      assert.deepEqual(result.openApi, openApi);
      assert.isUndefined(result.preCreate);
    });
  });

  describe("body scrubbing", () => {
    it("strips readonly and excluded fields before create and calls the user hook", async () => {
      const seen: unknown[] = [];
      const result = enrichModelRouterOptions(
        Note,
        {
          admin,
          preCreate: (value) => {
            seen.push(value);
            return {...(value as NoteFields), title: "from hook"} as NoteFields;
          },
        },
        {}
      );

      const created = await result.preCreate?.(
        {internalNote: "note", secret: "shh", title: "original"},
        request("user-1")
      );

      assert.deepEqual(seen, [{}]);
      assert.deepEqual(created, {title: "from hook"});
    });

    it("strips fields before update when no user hook is provided", async () => {
      const result = enrichModelRouterOptions(Note, {admin}, {});
      const updated = await result.preUpdate?.(
        {internalNote: "note", secret: "shh", title: "original"},
        request("user-1")
      );
      assert.deepEqual(updated, {});
    });

    it("passes a null user preUpdate result through", async () => {
      const result = enrichModelRouterOptions(Note, {admin, preUpdate: () => null}, {});
      assert.isNull(await result.preUpdate?.({title: "x"}, request("user-1")));
    });

    it("uses the user preUpdate result when it is not null", async () => {
      const result = enrichModelRouterOptions(
        Note,
        {admin, preUpdate: () => ({title: "hooked"}) as NoteFields},
        {}
      );
      assert.deepEqual(await result.preUpdate?.({title: "x"}, request("user-1")), {
        title: "hooked",
      });
    });
  });

  describe("realtime events", () => {
    const context = (): Parameters<typeof enrichModelRouterOptions>[2] => ({
      routePath: "/notes",
      terrenoApp,
    });

    it("emits a scrubbed create event", async () => {
      const result = enrichModelRouterOptions(Note, {admin: {...admin, realtime: true}}, context());
      await result.postCreate?.(
        doc({_id: "note-1", internalNote: "note", secret: "shh", title: "Buy milk"}),
        request("user-1")
      );

      assert.lengthOf(events, 1);
      assert.deepEqual(events[0].document, {_id: "note-1", title: "Buy milk"});
      assert.strictEqual(events[0].documentId, "note-1");
      assert.strictEqual(events[0].modelName, "AdminRouterNote");
      assert.strictEqual(events[0].routePath, "/notes");
      assert.strictEqual(events[0].type, "create");
      assert.deepEqual(events[0].user, {id: "user-1"});
      assert.isString(events[0].at);
    });

    it("emits update events and runs the user hook first", async () => {
      const order: string[] = [];
      terrenoApp = {
        emitAdminModelChanged: (event: AdminChangeEvent) => {
          order.push(event.type);
        },
      } as unknown as TerrenoApp;
      const result = enrichModelRouterOptions(
        Note,
        {
          admin: {...admin, realtime: true},
          postUpdate: () => {
            order.push("hook");
          },
        },
        {routePath: "/notes", terrenoApp}
      );

      await result.postUpdate?.(
        doc({_id: "note-2", title: "Updated"}),
        {title: "Updated"},
        request("user-1"),
        doc({_id: "note-2", title: "Old"})
      );

      assert.deepEqual(order, ["hook", "update"]);
    });

    it("runs the user postCreate and postDelete hooks", async () => {
      const calls: string[] = [];
      const result = enrichModelRouterOptions(
        Note,
        {
          admin: {...admin, realtime: true},
          postCreate: () => {
            calls.push("postCreate");
          },
          postDelete: () => {
            calls.push("postDelete");
          },
        },
        context()
      );

      await result.postCreate?.(doc({_id: "note-7", title: "New"}), request("user-1"));
      await result.postDelete?.(request("user-1"), doc({_id: "note-7", title: "New"}));

      assert.deepEqual(calls, ["postCreate", "postDelete"]);
      assert.deepEqual(
        events.map((event) => event.type),
        ["create", "delete"]
      );
    });

    it("omits the document on delete events", async () => {
      const result = enrichModelRouterOptions(Note, {admin: {...admin, realtime: true}}, context());
      await result.postDelete?.(request("user-1"), doc({_id: "note-3", title: "Gone"}));

      assert.lengthOf(events, 1);
      assert.strictEqual(events[0].type, "delete");
      assert.isUndefined(events[0].document);
    });

    it("falls back to the user id field when _id is absent", async () => {
      const result = enrichModelRouterOptions(Note, {admin: {...admin, realtime: true}}, context());
      await result.postCreate?.(doc({_id: "note-4", title: "Buy milk"}), {
        user: {id: "user-id-only"},
      } as unknown as express.Request);

      assert.deepEqual(events[0].user, {id: "user-id-only"});
    });

    it("skips emitting when the request has no user", async () => {
      const result = enrichModelRouterOptions(Note, {admin: {...admin, realtime: true}}, context());
      await result.postCreate?.(doc({_id: "note-5", title: "Buy milk"}), request());
      await result.postDelete?.(request(), doc({_id: "note-5", title: "Buy milk"}));
      assert.lengthOf(events, 0);
    });

    it("does not emit when realtime is off, the app is missing, or the route path is missing", async () => {
      const withoutRealtime = enrichModelRouterOptions(Note, {admin}, context());
      const withoutApp = enrichModelRouterOptions(
        Note,
        {admin: {...admin, realtime: true}},
        {routePath: "/notes"}
      );
      const withoutRoutePath = enrichModelRouterOptions(
        Note,
        {admin: {...admin, realtime: true}},
        {terrenoApp}
      );

      for (const options of [withoutRealtime, withoutApp, withoutRoutePath]) {
        await options.postCreate?.(doc({_id: "note-6", title: "Buy milk"}), request("user-1"));
        await options.postUpdate?.(
          doc({_id: "note-6", title: "Buy milk"}),
          {title: "Buy milk"},
          request("user-1"),
          doc({_id: "note-6", title: "Old"})
        );
        await options.postDelete?.(request("user-1"), doc({_id: "note-6", title: "Buy milk"}));
      }

      assert.lengthOf(events, 0);
    });
  });
});
