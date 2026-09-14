import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import {model, Schema} from "mongoose";

import {Permissions} from "../permissions";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {clearSyncRegistry, getSyncRegistry, registerSync} from "./registry";
import {syncPlugin} from "./syncSeqPlugin";

interface AdminBroadcastTodo extends IsDeleted {
  _id: string;
  ownerId: string;
  title: string;
  _syncSeq?: number;
}

const adminBroadcastTodoSchema = new Schema<AdminBroadcastTodo>({
  ownerId: {description: "The owner", type: String},
  title: {description: "The title", required: true, type: String},
});
adminBroadcastTodoSchema.plugin(isDeletedPlugin);
adminBroadcastTodoSchema.plugin(createdUpdatedPlugin);
adminBroadcastTodoSchema.plugin(syncPlugin);
const AdminBroadcastTodoModel = model<AdminBroadcastTodo>(
  "AdminBroadcastTodo",
  adminBroadcastTodoSchema
);

const syncOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsAuthenticated],
  },
  sync: {scope: {type: "owner" as const}},
};

describe("SyncConfig.adminBroadcast", () => {
  beforeEach(() => {
    clearSyncRegistry();
  });

  it("stores adminBroadcast true when registerSync is given the flag", () => {
    registerSync({
      config: {adminBroadcast: true, scope: {type: "owner"}},
      model: AdminBroadcastTodoModel,
      options: syncOptions,
      routePath: "/adminBroadcastTodos",
    });

    assert.strictEqual(getSyncRegistry()[0]?.config.adminBroadcast, true);
  });

  it("stores adminBroadcast false when registerSync omits the flag", () => {
    registerSync({
      config: {scope: {type: "owner"}},
      model: AdminBroadcastTodoModel,
      options: syncOptions,
      routePath: "/adminBroadcastTodos",
    });

    assert.strictEqual(getSyncRegistry()[0]?.config.adminBroadcast, false);
  });

  it("stores adminBroadcast false when the host sets the flag to false", () => {
    registerSync({
      config: {adminBroadcast: false, scope: {type: "owner"}},
      model: AdminBroadcastTodoModel,
      options: syncOptions,
      routePath: "/adminBroadcastTodos",
    });

    assert.strictEqual(getSyncRegistry()[0]?.config.adminBroadcast, false);
  });

  it("rejects a second registerSync for the same route path", () => {
    registerSync({
      config: {adminBroadcast: true, scope: {type: "owner"}},
      model: AdminBroadcastTodoModel,
      options: syncOptions,
      routePath: "/adminBroadcastTodos",
    });

    assert.throws(() => {
      registerSync({
        config: {adminBroadcast: true, scope: {type: "owner"}},
        model: AdminBroadcastTodoModel,
        options: syncOptions,
        routePath: "/adminBroadcastTodos",
      });
    }, /already registered/);
  });
});
