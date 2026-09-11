/**
 * Characterization tests for the admin windowed sync write authorization gap.
 *
 * AdminModelForm windowed writes call POST /sync/mutate, which runs the **product**
 * modelRouter pipeline (entry.options from registerSync). Admin REST uses a separate
 * AdminApp modelRouter with writeOwned/isOwned, stripProtectedFromBody, permissions
 * toggles, and onAdminAudit — none of which apply on the sync mutation path today.
 *
 * These tests document the mismatch before a fix lands. They assert REST denies while
 * sync allows (or strips vs persists) so CI fails once authorization is aligned.
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
}: {
  grants: Record<string, string[]>;
  onAdminAudit?: (event: AdminAuditEvent) => void | Promise<void>;
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
    resolvePermissions: async () => grants,
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
  new SyncApp().register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("admin sync mutation authorization mismatch (characterization)", () => {
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

  it("REST PATCH denies writeOwned update on another owner's row but POST /sync/mutate applies it", async () => {
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

    const ownedPatch = await agent
      .patch(`/admin/window-todos/${owned._id}`)
      .send({title: "REST ok"})
      .expect(200);
    expect(ownedPatch.body.data.title).toBe("REST ok");

    const syncRes = await agent
      .post("/sync/mutate")
      .send({
        baseVersion: other._syncSeq ?? 1,
        collection: "window-todos",
        data: {title: "Sync bypass"},
        id: other._id,
        mutationId: "repro-writeowned-update",
        operation: "update",
      })
      .expect(200);

    expect(syncRes.body.ack.mutationId).toBe("repro-writeowned-update");
    const reloaded = await WindowTodoModel.findById(other._id).lean();
    expect(reloaded?.title).toBe("Sync bypass");
  });

  it("REST PATCH strips readonlyFields but POST /sync/mutate persists protected keys", async () => {
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
      .send({
        baseVersion: afterRest?._syncSeq ?? 2,
        collection: "window-todos",
        data: {protectedLabel: "Sync wrote protected", title: "After sync"},
        id: row._id,
        mutationId: "repro-readonly-bypass",
        operation: "update",
      })
      .expect(200);

    expect(syncRes.body.ack.mutationId).toBe("repro-readonly-bypass");
    const afterSync = await WindowTodoModel.findById(row._id).lean();
    expect(afterSync?.protectedLabel).toBe("Sync wrote protected");
    expect(afterSync?.title).toBe("After sync");
  });

  it("REST DELETE is disabled but POST /sync/mutate delete still succeeds", async () => {
    const row = await WindowTodoModel.create({
      ownerId: actorId,
      title: "To delete",
    });

    const restDelete = await agent.delete(`/admin/window-todos/${row._id}`);
    expect([403, 405]).toContain(restDelete.status);

    const syncRes = await agent
      .post("/sync/mutate")
      .send({
        collection: "window-todos",
        id: row._id,
        mutationId: "repro-delete-disabled",
        operation: "delete",
      })
      .expect(200);

    expect(syncRes.body.ack.mutationId).toBe("repro-delete-disabled");
    const tombstones = await WindowTodoModel.find({_id: row._id, deleted: true});
    expect(tombstones).toHaveLength(1);
  });

  it("onAdminAudit fires for REST PATCH but not for POST /sync/mutate update", async () => {
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
      .send({
        baseVersion: current?._syncSeq ?? 2,
        collection: "window-todos",
        data: {title: "Sync no audit"},
        id: row._id,
        mutationId: "repro-audit-gap",
        operation: "update",
      })
      .expect(200);

    expect(auditEvents.filter((event) => event.verb === "updated")).toHaveLength(1);
  });
});
