import {beforeEach, describe, expect, it} from "bun:test";
import {model, Schema} from "mongoose";

import type {ModelRouterOptions} from "../api";
import {registerCollection} from "../collectionRegistry";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {
  applySyncRegistrationSideEffects,
  clearSyncIndexCreationTasks,
  ensureSyncIndexes,
  trackSyncIndexCreation,
} from "./registrationSideEffects";
import {clearSyncRegistry, registerSync} from "./registry";
import {syncPlugin} from "./syncSeqPlugin";

interface SideEffectTodo extends IsDeleted {
  _id: string;
  ownerId: string;
  title: string;
  _syncSeq?: number;
}

const buildModel = (name: string, extraFields: Record<string, unknown> = {}) => {
  const schema = new Schema<SideEffectTodo>({
    ownerId: {description: "The owner", type: String},
    title: {description: "The title", required: true, type: String},
    ...extraFields,
  });
  schema.plugin(isDeletedPlugin);
  schema.plugin(createdUpdatedPlugin);
  schema.plugin(syncPlugin);
  return model<SideEffectTodo>(name, schema);
};

const authedOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsAuthenticated],
  },
} as unknown as ModelRouterOptions<SideEffectTodo>;

describe("applySyncRegistrationSideEffects", () => {
  beforeEach(() => {
    clearSyncRegistry();
  });

  it("requires snapshotFilter when scope is a custom resolver function", () => {
    const SideEffectTodoModel = buildModel("SideEffectCustomScope");
    expect(() =>
      applySyncRegistrationSideEffects({
        config: {scope: () => "owner:abc"},
        existingSyncEntries: [],
        model: SideEffectTodoModel,
        options: authedOptions,
        routePath: "/sideEffectCustomScope",
      })
    ).toThrow(/snapshotFilter/);
  });

  it("rejects registering the same model name on a second route path", () => {
    const SideEffectTodoModel = buildModel("SideEffectDupModel");
    registerSync({
      config: {scope: {type: "owner"}},
      model: SideEffectTodoModel,
      options: authedOptions,
      routePath: "/sideEffectDupA",
    });

    expect(() =>
      registerSync({
        config: {scope: {type: "owner"}},
        model: SideEffectTodoModel,
        options: authedOptions,
        routePath: "/sideEffectDupB",
      })
    ).toThrow(/already registered/);
  });

  it("rejects a duplicate collection tag across route path spellings", () => {
    const FirstModel = buildModel("SideEffectDupTagA");
    registerCollection({
      model: FirstModel,
      options: {...authedOptions, sync: {scope: {type: "owner"}}},
      routePath: "/sideEffectDupTag",
    });

    const SecondModel = buildModel("SideEffectDupTagB");
    expect(() =>
      applySyncRegistrationSideEffects({
        config: {scope: {type: "owner"}},
        existingSyncEntries: [{collectionTag: "sideEffectDupTag", modelName: "SideEffectDupTagA"}],
        model: SecondModel,
        options: authedOptions,
        routePath: "sideEffectDupTag",
      })
    ).toThrow(/already registered/);
  });

  it("wraps createIndex failures in an actionable APIError at startup", async () => {
    const SideEffectTodoModel = buildModel("SideEffectIndexFail");
    SideEffectTodoModel.collection.createIndex = async (): Promise<string> => {
      throw new Error("boom: index build failed");
    };
    applySyncRegistrationSideEffects({
      config: {scope: {type: "owner"}},
      existingSyncEntries: [],
      model: SideEffectTodoModel,
      options: authedOptions,
      routePath: "/sideEffectIndexFail",
    });

    await expect(ensureSyncIndexes()).rejects.toThrow(/Failed to create sync snapshot index/);
  });

  it("clearSyncIndexCreationTasks drops deferred index work", async () => {
    trackSyncIndexCreation(async () => {
      throw new Error("should not run");
    });
    clearSyncIndexCreationTasks();
    await expect(ensureSyncIndexes()).resolves.toBeUndefined();
  });
});
