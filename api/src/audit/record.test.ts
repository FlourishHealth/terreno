import {afterEach, beforeEach, describe, it, spyOn} from "bun:test";
import {assert} from "chai";
import type express from "express";
import mongoose from "mongoose";

import type {UserModel as AuthUserModel} from "../auth";
import {logger} from "../logger";
import {TerrenoApp} from "../terrenoApp";
import {setupDb, UserModel} from "../tests";
import {AuditApp} from "./auditApp";
import type {AuditEventModel} from "./auditEventModel";
import {
  installAuditRecorder,
  isAuditRecorderInstalled,
  maybeRecordAdminAudit,
  maybeRecordModelRouterAudit,
  recordAuditEvent,
  resetAuditRecorderForTests,
} from "./record";

const typedUserModel = UserModel as unknown as AuthUserModel;

const deleteAuditEventModel = (): void => {
  if (mongoose.connection.models.AuditEvent) {
    mongoose.connection.deleteModel("AuditEvent");
  }
};

const registerAuditApp = (): void => {
  new TerrenoApp({
    skipListen: true,
    userModel: typedUserModel,
  })
    .register(new AuditApp())
    .build();
};

describe("audit record helpers", () => {
  beforeEach(async () => {
    deleteAuditEventModel();
    resetAuditRecorderForTests();
    await setupDb();
    await mongoose.connection.collection("auditevents").deleteMany({});
  });

  afterEach(() => {
    resetAuditRecorderForTests();
    deleteAuditEventModel();
  });

  it("reports whether the recorder is installed", () => {
    assert.isFalse(isAuditRecorderInstalled());
    registerAuditApp();
    assert.isTrue(isAuditRecorderInstalled());
  });

  it("records admin created, updated, and deleted verbs", async () => {
    registerAuditApp();
    const actorId = new mongoose.Types.ObjectId().toString();
    const req = {user: {id: actorId}} as express.Request;
    await maybeRecordAdminAudit({
      after: {_id: "food-1", name: "Soup"},
      modelName: "Food",
      recordLabel: "Soup",
      req,
      verb: "created",
    });
    await maybeRecordAdminAudit({
      after: {_id: "food-1", name: "Stew"},
      before: {_id: "food-1", name: "Soup"},
      modelName: "Food",
      req,
      verb: "updated",
    });
    await maybeRecordAdminAudit({
      before: {_id: "food-1", name: "Stew"},
      modelName: "Food",
      req,
      verb: "deleted",
    });
    const events = await mongoose.connection
      .collection("auditevents")
      .find({})
      .sort({created: 1})
      .toArray();
    assert.equal(events.length, 3);
    assert.deepEqual(
      events.map((row) => row.operation),
      ["create", "update", "delete"]
    );
    assert.equal(events[0]?.recordLabel, "Soup");
    assert.equal(String(events[0]?.actorId), actorId);
    assert.equal(events[0]?.source, "admin");
  });

  it("uses user._id when user.id is missing", async () => {
    registerAuditApp();
    const actorId = new mongoose.Types.ObjectId();
    await maybeRecordAdminAudit({
      after: {_id: "2", title: "Note"},
      modelName: "Note",
      req: {user: {_id: actorId}} as express.Request,
      verb: "created",
    });
    const event = await mongoose.connection.collection("auditevents").findOne({});
    assert.equal(String(event?.actorId), actorId.toString());
  });

  it("omits actorId when the request has no user id", async () => {
    registerAuditApp();
    await maybeRecordAdminAudit({
      after: {_id: "3", title: "Anon"},
      modelName: "Note",
      req: {user: {}} as express.Request,
      verb: "created",
    });
    const event = await mongoose.connection.collection("auditevents").findOne({});
    assert.isUndefined(event?.actorId);
  });

  it("does not throw when admin audit serialization fails", async () => {
    registerAuditApp();
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger);
    const after = {
      toJSON: (): never => {
        throw new Error("circular");
      },
    };
    await maybeRecordAdminAudit({
      after,
      modelName: "Note",
      req: {} as express.Request,
      verb: "created",
    });
    assert.equal(await mongoose.connection.collection("auditevents").countDocuments(), 0);
    assert.isTrue(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("Failed to persist"))
    );
    errorSpy.mockRestore();
  });

  it("skips modelRouter writes when audit is unset", async () => {
    registerAuditApp();
    await maybeRecordModelRouterAudit({
      after: {_id: "4", title: "Off"},
      modelName: "Note",
      operation: "create",
      recordId: "4",
      req: {} as express.Request,
      verb: "created",
    });
    assert.equal(await mongoose.connection.collection("auditevents").countDocuments(), 0);
  });

  it("applies extra redact from modelRouter audit options", async () => {
    registerAuditApp();
    await maybeRecordModelRouterAudit({
      after: {_id: "5", secret: "hidden", title: "Safe"},
      audit: {redact: ["secret"]},
      modelName: "Note",
      operation: "create",
      recordId: "5",
      req: {} as express.Request,
      verb: "created",
    });
    const event = await mongoose.connection.collection("auditevents").findOne({});
    assert.notProperty(event?.after as object, "secret");
    assert.equal((event?.after as {title?: string})?.title, "Safe");
  });

  it("treats empty audit options as default redact", async () => {
    registerAuditApp();
    await maybeRecordModelRouterAudit({
      after: {_id: "6", password: "p", title: "Has default"},
      audit: {},
      modelName: "Note",
      operation: "create",
      recordId: "6",
      req: {} as express.Request,
      verb: "created",
    });
    const event = await mongoose.connection.collection("auditevents").findOne({});
    assert.notProperty(event?.after as object, "password");
    assert.equal((event?.after as {title?: string})?.title, "Has default");
  });

  it("reads organization from req.organization string and from document _id objects", async () => {
    registerAuditApp();
    await maybeRecordModelRouterAudit({
      after: {_id: "7", title: "Req org"},
      audit: true,
      modelName: "Note",
      operation: "create",
      recordId: "7",
      req: {organization: "org-string"} as express.Request & {organization: string},
      verb: "created",
    });
    await maybeRecordModelRouterAudit({
      after: {_id: {_id: "8"}, organizationId: {_id: "org-nested"}, title: "Nested"},
      audit: true,
      modelName: "Note",
      operation: "create",
      recordId: "8",
      req: {} as express.Request,
      verb: "created",
    });
    await maybeRecordModelRouterAudit({
      after: {_id: "9", organizationId: "", title: "Empty org"},
      audit: true,
      modelName: "Note",
      operation: "create",
      recordId: "9",
      req: {organization: {_id: "org-from-id", id: null}} as express.Request & {
        organization: {_id: string; id: null};
      },
      verb: "created",
    });
    await maybeRecordModelRouterAudit({
      after: {_id: "10", title: "Org id field"},
      audit: true,
      modelName: "Note",
      operation: "create",
      recordId: "10",
      req: {organization: {id: "org-id-field"}} as express.Request & {
        organization: {id: string};
      },
      verb: "created",
    });
    await maybeRecordModelRouterAudit({
      after: {_id: "11", organizationId: 42, title: "Numeric org"},
      audit: true,
      modelName: "Note",
      operation: "create",
      recordId: "11",
      req: {} as express.Request,
      verb: "created",
    });
    const events = await mongoose.connection
      .collection("auditevents")
      .find({})
      .sort({recordId: 1})
      .toArray();
    assert.equal(events.find((row) => row.recordId === "7")?.organizationId, "org-string");
    assert.equal(events.find((row) => row.recordId === "8")?.organizationId, "org-nested");
    assert.equal(events.find((row) => row.recordId === "9")?.organizationId, "org-from-id");
    assert.equal(events.find((row) => row.recordId === "10")?.organizationId, "org-id-field");
    assert.equal(events.find((row) => row.recordId === "11")?.organizationId, "42");
  });

  it("swallows persist failures from recordAuditEvent", async () => {
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger);
    installAuditRecorder({
      create: async () => {
        throw new Error("write failed");
      },
    } as unknown as AuditEventModel);
    await recordAuditEvent({
      modelName: "Note",
      operation: "create",
      source: "modelRouter",
      verb: "created",
    });
    assert.isTrue(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("Failed to persist"))
    );
    errorSpy.mockRestore();
  });

  it("does not persist when recordAuditEvent targets AuditEvent", async () => {
    registerAuditApp();
    await recordAuditEvent({
      after: {modelName: "Todo"},
      modelName: "AuditEvent",
      operation: "create",
      source: "admin",
      verb: "created",
    });
    assert.equal(await mongoose.connection.collection("auditevents").countDocuments(), 0);
  });
});
