import {afterEach, beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import mongoose from "mongoose";

import type {UserModel as AuthUserModel} from "../auth";
import {TerrenoApp} from "../terrenoApp";
import {authAsUser, setupDb, UserModel} from "../tests";
import {AuditApp} from "./auditApp";
import {createAuditEventModel, getAuditEventIndexSpecs} from "./auditEventModel";

const typedUserModel = UserModel as unknown as AuthUserModel;

const deleteAuditEventModel = (): void => {
  if (mongoose.connection.models.AuditEvent) {
    mongoose.connection.deleteModel("AuditEvent");
  }
};

describe("AuditApp", () => {
  beforeEach(async () => {
    deleteAuditEventModel();
    await setupDb();
    await mongoose.connection.collection("auditevents").deleteMany({});
  });

  afterEach(() => {
    deleteAuditEventModel();
  });

  it("does not register AuditEvent on the default connection when @terreno/api is imported", async () => {
    deleteAuditEventModel();
    await import("../index");
    assert.isUndefined(mongoose.connection.models.AuditEvent);
  });

  it("lets an admin list an empty audit log", async () => {
    const app = new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(new AuditApp())
      .build();
    const agent = await authAsUser(app, "admin");

    const res = await agent.get("/audit-events").expect(200);
    assert.deepEqual(res.body.data, []);
    assert.isUndefined(new AuditApp().getRetentionDays());
  });

  it("rejects a non-admin list", async () => {
    const app = new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(new AuditApp())
      .build();
    const agent = await authAsUser(app, "notAdmin");

    const res = await agent.get("/audit-events");
    // modelRouter permissionMiddleware uses 405 when list permissions fail.
    assert.equal(res.status, 405);
  });

  it("indexes created desc and modelName+recordId+created for per-record history", () => {
    const specs = getAuditEventIndexSpecs();
    assert.isTrue(
      specs.some((fields) => fields.created === -1 && Object.keys(fields).length === 1)
    );
    assert.isTrue(
      specs.some(
        (fields) => fields.modelName === 1 && fields.recordId === 1 && fields.created === -1
      )
    );
  });

  it("does not expose create, update, or delete", async () => {
    const app = new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(new AuditApp())
      .build();
    const agent = await authAsUser(app, "admin");
    const model = createAuditEventModel(mongoose.connection);
    const row = await model.create({
      modelName: "Todo",
      operation: "create",
      source: "modelRouter",
      verb: "created",
    });

    const post = await agent.post("/audit-events").send({modelName: "Todo", verb: "created"});
    const patch = await agent.patch(`/audit-events/${row._id}`).send({recordLabel: "x"});
    const del = await agent.delete(`/audit-events/${row._id}`);
    const read = await agent.get(`/audit-events/${row._id}`).expect(200);
    assert.equal(read.body.data.modelName, "Todo");
    assert.equal(post.status, 405);
    assert.equal(patch.status, 405);
    assert.equal(del.status, 405);
  });
});
