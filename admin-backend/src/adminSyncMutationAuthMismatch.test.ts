/**
 * Admin windowed sync write authorization: REST and `POST /sync/mutate` with
 * `mutationMode: "adminWindow"` must enforce the same AdminApp semantics.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {
  ADMIN_MODEL_ACCESS,
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  clearSyncRegistry,
  createAccess,
  createdUpdatedPlugin,
  findOneOrNoneFor,
  isDeletedPlugin,
  Permissions,
  registerSync,
  SyncApp,
  setupAuth,
  syncPlugin,
  terrenoStatements,
  type User,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import type express from "express";
import mongoose from "mongoose";
import type TestAgent from "supertest/lib/agent";

import type {AdminAuditEvent, AdminModelConfig} from "./adminApp";
import {AdminApp, adminOwnedBy} from "./adminApp";

interface WindowTodo {
  _id: string;
  ownerId: string;
  title: string;
  protectedLabel?: string;
  _syncSeq?: number;
}

const windowTodoSchema = new mongoose.Schema<WindowTodo>({
  _id: {
    default: (): string => new mongoose.Types.ObjectId().toHexString(),
    description: "Client-minted string id",
    type: String,
  },
  ownerId: {description: "Owner user id", required: true, type: String},
  protectedLabel: {description: "Admin readonly label", type: String},
  title: {description: "Todo title", required: true, type: String},
});
windowTodoSchema.plugin(isDeletedPlugin);
windowTodoSchema.plugin(createdUpdatedPlugin);
windowTodoSchema.plugin(syncPlugin);

const WindowTodoModel =
  mongoose.models.WindowTodo ?? mongoose.model<WindowTodo>("WindowTodo", windowTodoSchema);

const windowTodoAdminConfig: AdminModelConfig = {
  adminAccess: {isOwned: adminOwnedBy("ownerId")},
  displayName: "Window todos",
  listFields: ["title", "ownerId", "protectedLabel"],
  model: WindowTodoModel,
  permissions: {delete: false, update: true},
  readonlyFields: ["protectedLabel"],
  routePath: "/window-todos",
};

const productSyncOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsOwner],
  },
  preCreate: (body: Record<string, unknown>, req: express.Request): Record<string, unknown> => ({
    ...body,
    ownerId: String((req.user as {id?: string} | undefined)?.id ?? body.ownerId),
  }),
  sync: {adminBroadcast: true, scope: {type: "owner" as const}},
};

const buildHarness = ({
  grants,
  onAdminAudit,
  resolvePermissions,
}: {
  grants: Record<string, string[]>;
  onAdminAudit?: (event: AdminAuditEvent) => void | Promise<void>;
  resolvePermissions?: (args: {user: User}) => Promise<Record<string, string[]>>;
}): express.Application => {
  clearSyncRegistry();
  registerSync({
    config: {adminBroadcast: true, scope: {type: "owner"}},
    model: WindowTodoModel,
    options: productSyncOptions,
    routePath: "/window-todos",
  });

  const accessControl = createAccess({
    connection: mongoose.connection,
    resolvePermissions:
      resolvePermissions ??
      (async ({user}) => {
        if (user?.admin) {
          return grants;
        }
        return {};
      }),
    statements: {...terrenoStatements, adminWindowTodo: ADMIN_MODEL_ACCESS},
  });

  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  new AdminApp({
    accessControl,
    basePath: "/admin",
    models: [
      {
        ...windowTodoAdminConfig,
        adminAccess: {
          isOwned: adminOwnedBy("ownerId"),
          resource: "adminWindowTodo",
        },
      },
    ],
    onAdminAudit,
  }).register(app);
  new SyncApp({accessControl}).register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

const adminWindowMutate = (body: Record<string, unknown>): Record<string, unknown> => ({
  ...body,
  mutationMode: "adminWindow",
});

describe("admin window sync mutation authorization", () => {
  let agent: TestAgent;
  let actorId: string;
  let otherOwnerId: string;

  beforeEach(async () => {
    await setupDb();
    otherOwnerId = new mongoose.Types.ObjectId().toHexString();
    const app = buildHarness({
      grants: {admin: ["access"], adminWindowTodo: ["read", "writeOwned"]},
    });
    agent = await authAsUser(app, "admin");
    const actor = await findOneOrNoneFor(UserModel, {email: "admin@example.com"});
    assert.exists(actor);
    actorId = String(actor?._id);
  });

  afterEach(async () => {
    clearSyncRegistry();
    await WindowTodoModel.deleteMany({});
  });

  it("REST PATCH and admin-window sync both deny writeOwned update on another owner's row", async () => {
    const owned = await WindowTodoModel.create({
      ownerId: actorId,
      protectedLabel: "mine",
      title: "Owned",
    });
    const other = await WindowTodoModel.create({
      ownerId: otherOwnerId,
      protectedLabel: "theirs",
      title: "Other",
    });

    await agent.patch(`/admin/window-todos/${other._id}`).send({title: "REST blocked"}).expect(403);

    const syncRes = await agent
      .post("/sync/mutate")
      .send(
        adminWindowMutate({
          baseVersion: other._syncSeq ?? 1,
          collection: "window-todos",
          data: {title: "Sync blocked"},
          id: other._id,
          mutationId: "admin-writeowned-deny",
          operation: "update",
        })
      )
      .expect(403);

    expect(syncRes.body.nack.code).toBe("unauthorized");
    const reloaded = await WindowTodoModel.findById(other._id).lean();
    expect(reloaded?.title).toBe("Other");

    await agent.patch(`/admin/window-todos/${owned._id}`).send({title: "REST ok"}).expect(200);
  });

  it("REST PATCH and admin-window sync both strip readonlyFields", async () => {
    const row = await WindowTodoModel.create({
      ownerId: actorId,
      protectedLabel: "keep-me",
      title: "Before",
    });

    await agent
      .patch(`/admin/window-todos/${row._id}`)
      .send({protectedLabel: "REST stripped", title: "After REST"})
      .expect(200);

    const afterRest = await WindowTodoModel.findById(row._id).lean();
    expect(afterRest?.protectedLabel).toBe("keep-me");
    expect(afterRest?.title).toBe("After REST");

    const syncRes = await agent
      .post("/sync/mutate")
      .send(
        adminWindowMutate({
          baseVersion: afterRest?._syncSeq ?? 2,
          collection: "window-todos",
          data: {protectedLabel: "Sync stripped", title: "After sync"},
          id: row._id,
          mutationId: "admin-readonly-strip",
          operation: "update",
        })
      )
      .expect(200);

    expect(syncRes.body.ack.mutationId).toBe("admin-readonly-strip");
    const afterSync = await WindowTodoModel.findById(row._id).lean();
    expect(afterSync?.protectedLabel).toBe("keep-me");
    expect(afterSync?.title).toBe("After sync");
  });

  it("REST DELETE disabled and admin-window sync delete both return unauthorized", async () => {
    const row = await WindowTodoModel.create({
      ownerId: actorId,
      title: "To delete",
    });

    const restDelete = await agent.delete(`/admin/window-todos/${row._id}`);
    expect([403, 405]).toContain(restDelete.status);

    const syncRes = await agent
      .post("/sync/mutate")
      .send(
        adminWindowMutate({
          collection: "window-todos",
          id: row._id,
          mutationId: "admin-delete-disabled",
          operation: "delete",
        })
      )
      .expect(403);

    expect(syncRes.body.nack.code).toBe("unauthorized");
    const stillThere = await WindowTodoModel.findById(row._id).lean();
    expect(stillThere?.deleted).not.toBe(true);
  });

  it("onAdminAudit fires for REST PATCH and admin-window sync update", async () => {
    const auditEvents: AdminAuditEvent[] = [];
    const app = buildHarness({
      grants: {admin: ["access"], adminWindowTodo: ["read", "write"]},
      onAdminAudit: async (event) => {
        auditEvents.push(event);
      },
    });
    const writer = await authAsUser(app, "admin");
    const row = await WindowTodoModel.create({
      ownerId: actorId,
      title: "Audited",
    });

    await writer.patch(`/admin/window-todos/${row._id}`).send({title: "REST audit"}).expect(200);
    expect(auditEvents.filter((event) => event.verb === "updated")).toHaveLength(1);

    const current = await WindowTodoModel.findById(row._id).lean();
    await writer
      .post("/sync/mutate")
      .send(
        adminWindowMutate({
          baseVersion: current?._syncSeq ?? 2,
          collection: "window-todos",
          data: {title: "Sync audit"},
          id: row._id,
          mutationId: "admin-sync-audit",
          operation: "update",
        })
      )
      .expect(200);

    expect(auditEvents.filter((event) => event.verb === "updated")).toHaveLength(2);
  });

  it("rejects admin-window marker spoofing from a non-admin product user", async () => {
    const app = buildHarness({
      grants: {admin: ["access"], adminWindowTodo: ["read", "write"]},
    });
    const stranger = await authAsUser(app, "notAdmin");
    const row = await WindowTodoModel.create({
      ownerId: otherOwnerId,
      title: "Protected",
    });

    const syncRes = await stranger
      .post("/sync/mutate")
      .send(
        adminWindowMutate({
          baseVersion: row._syncSeq ?? 1,
          collection: "window-todos",
          data: {title: "Spoofed"},
          id: row._id,
          mutationId: "spoof-admin-window",
          operation: "update",
        })
      )
      .expect(403);

    expect(syncRes.body.nack.code).toBe("unauthorized");
    const reloaded = await WindowTodoModel.findById(row._id).lean();
    expect(reloaded?.title).toBe("Protected");
  });

  it("product sync path without admin-window marker keeps IsOwner semantics", async () => {
    const app = buildHarness({
      grants: {admin: ["access"], adminWindowTodo: ["read", "write"]},
    });
    const productUser = await authAsUser(app, "notAdmin");
    const row = await WindowTodoModel.create({
      ownerId: otherOwnerId,
      title: "Product path",
    });

    const syncRes = await productUser
      .post("/sync/mutate")
      .send({
        baseVersion: row._syncSeq ?? 1,
        collection: "window-todos",
        data: {title: "Product denied"},
        id: row._id,
        mutationId: "product-isowner-deny",
        operation: "update",
      })
      .expect(403);

    expect(syncRes.body.nack.code).toBe("unauthorized");
    const reloaded = await WindowTodoModel.findById(row._id).lean();
    expect(reloaded?.title).toBe("Product path");
  });
});
