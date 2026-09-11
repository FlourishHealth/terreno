import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {addAuthRoutes, setupAuth, type UserModel as UserModelType} from "../auth";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, findOneOrNoneFor, isDeletedPlugin} from "../plugins";
import {authAsUser, getBaseServer, setupDb, UserModel} from "../tests";
import {
  clearAdminWindowMutationScopes,
  prepareAdminWindowMutation,
  registerAdminWindowMutationScope,
} from "./adminWindowMutation";
import {clearSyncRegistry, findSyncEntryByCollectionTag, registerSync} from "./registry";
import {syncPlugin} from "./syncSeqPlugin";

interface WindowTodo {
  _id: string;
  ownerId: string;
  title: string;
}

const windowTodoSchema = new mongoose.Schema<WindowTodo>({
  _id: {
    default: (): string => new mongoose.Types.ObjectId().toHexString(),
    type: String,
  },
  ownerId: {required: true, type: String},
  title: {required: true, type: String},
});
windowTodoSchema.plugin(isDeletedPlugin);
windowTodoSchema.plugin(createdUpdatedPlugin);
windowTodoSchema.plugin(syncPlugin);

const WindowTodoModel =
  mongoose.models.WindowTodo ?? mongoose.model<WindowTodo>("WindowTodo", windowTodoSchema);

describe("adminWindowMutation", () => {
  beforeEach(async () => {
    await setupDb();
    clearSyncRegistry();
    clearAdminWindowMutationScopes();
    registerSync({
      config: {adminBroadcast: true, scope: {type: "owner"}},
      model: WindowTodoModel,
      options: {
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [Permissions.IsAuthenticated],
          list: [Permissions.IsAuthenticated],
          read: [Permissions.IsAuthenticated],
          update: [Permissions.IsOwner],
        },
        sync: {adminBroadcast: true, scope: {type: "owner"}},
      },
      routePath: "/window-todos",
    });
    registerAdminWindowMutationScope("WindowTodo", {
      createPermissions: [Permissions.IsAdmin],
      deletePermissions: [Permissions.IsAdmin],
      modelName: "WindowTodo",
      permissions: {create: true, delete: true, update: true},
      stripMutationData: (data) => {
        const next = {...data};
        delete next.ownerId;
        return next;
      },
      updatePermissions: [Permissions.IsAdmin],
    });
  });

  afterEach(async () => {
    clearSyncRegistry();
    await WindowTodoModel.deleteMany({});
  });

  const loadUser = async (type: "admin" | "notAdmin") => {
    const app = getBaseServer();
    setupAuth(app, UserModel as unknown as UserModelType);
    addAuthRoutes(app, UserModel as unknown as UserModelType);
    await authAsUser(app, type);
    const email = type === "admin" ? "admin@example.com" : "notAdmin@example.com";
    const doc = await findOneOrNoneFor(UserModel, {email});
    expect(doc).toBeTruthy();
    return doc as {admin?: boolean; id: string};
  };

  it("returns undefined for product mutations without a marker", async () => {
    const user = await loadUser("notAdmin");
    const entry = findSyncEntryByCollectionTag("window-todos");
    if (!entry) {
      throw new Error("expected window-todos sync entry");
    }
    const prepared = await prepareAdminWindowMutation({
      entry,
      mutation: {
        collection: "window-todos",
        data: {title: "x"},
        mutationId: "product",
        operation: "create",
      },
      req: {user} as never,
      user,
    });
    expect(prepared).toBeUndefined();
  });

  it("rejects admin-window marker from non-admin callers", async () => {
    const user = await loadUser("notAdmin");
    const entry = findSyncEntryByCollectionTag("window-todos");
    if (!entry) {
      throw new Error("expected window-todos sync entry");
    }
    await expect(
      prepareAdminWindowMutation({
        entry,
        mutation: {
          collection: "window-todos",
          data: {title: "x"},
          mutationId: "spoof",
          mutationMode: "adminWindow",
          operation: "create",
        },
        req: {user} as never,
        user,
      })
    ).rejects.toMatchObject({status: 403});
  });

  it("strips readonly fields for admin-window mutations", async () => {
    const user = await loadUser("admin");
    const entry = findSyncEntryByCollectionTag("window-todos");
    if (!entry) {
      throw new Error("expected window-todos sync entry");
    }
    const prepared = await prepareAdminWindowMutation({
      entry,
      mutation: {
        collection: "window-todos",
        data: {ownerId: "hijack", title: "ok"},
        mutationId: "strip",
        mutationMode: "adminWindow",
        operation: "create",
      },
      req: {user} as never,
      user,
    });
    expect(prepared?.mutation.data).toEqual({title: "ok"});
  });
});
