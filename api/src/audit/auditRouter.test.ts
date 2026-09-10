import {afterEach, beforeEach, describe, it, spyOn} from "bun:test";
import {assert} from "chai";
import type express from "express";
import mongoose from "mongoose";

import {modelRouter} from "../api";
import type {UserModel as AuthUserModel} from "../auth";
import {logger} from "../logger";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, findExactlyOne, findOneOrNone} from "../plugins";
import {TerrenoApp} from "../terrenoApp";
import {authAsUser, setupDb, UserModel} from "../tests";
import {AuditApp} from "./auditApp";
import {createAuditEventModel} from "./auditEventModel";
import {changedFieldDiff, isRedactedSegment} from "./diff";
import {maybeRecordModelRouterAudit, resetAuditRecorderForTests} from "./record";

const typedUserModel = UserModel as unknown as AuthUserModel;

interface Note {
  calories?: number;
  password?: string;
  ssn?: string;
  tags?: string[];
  title: string;
}

const noteSchema = new mongoose.Schema<Note>(
  {
    calories: {description: "Calories", type: Number},
    password: {description: "Secret password", type: String},
    ssn: {description: "Social security number", type: String},
    tags: {description: "Tags", type: [String]},
    title: {description: "Note title", required: true, type: String},
  },
  {strict: "throw"}
);
noteSchema.plugin(createdUpdatedPlugin);
noteSchema.plugin(findOneOrNone);
noteSchema.plugin(findExactlyOne);

const deleteNamedModel = (name: string): void => {
  if (mongoose.connection.models[name]) {
    mongoose.connection.deleteModel(name);
  }
};

const notePermissions = {
  create: [Permissions.IsAuthenticated],
  delete: [Permissions.IsAuthenticated],
  list: [Permissions.IsAuthenticated],
  read: [Permissions.IsAuthenticated],
  update: [Permissions.IsAuthenticated],
};

const buildApp = (audit: true | {redact: string[]} = true): express.Application => {
  const NoteModel = mongoose.model<Note>("Note", noteSchema);
  const app = new TerrenoApp({
    skipListen: true,
    userModel: typedUserModel,
  })
    .register(new AuditApp())
    .build();
  app.use("/notes", modelRouter(NoteModel, {audit, permissions: notePermissions}));
  return app;
};

describe("changedFieldDiff", () => {
  it("redacts default secret segments case-insensitively", () => {
    assert.isTrue(isRedactedSegment("Password"));
    assert.isTrue(isRedactedSegment("refreshToken"));
    const diff = changedFieldDiff({
      after: {password: "secret", title: "Hi", token: "abc"},
      before: {password: "old", title: "Lo", token: "xyz"},
    });
    assert.deepEqual(diff, {after: {title: "Hi"}, before: {title: "Lo"}});
  });

  it("omits extra redact fields", () => {
    const diff = changedFieldDiff({
      after: {ssn: "999", title: "B"},
      before: {ssn: "111", title: "A"},
      extraRedact: ["ssn"],
    });
    assert.deepEqual(diff, {after: {title: "B"}, before: {title: "A"}});
  });
});

describe("modelRouter audit", () => {
  beforeEach(async () => {
    resetAuditRecorderForTests();
    deleteNamedModel("Note");
    deleteNamedModel("AuditEvent");
    await setupDb();
    await mongoose.connection.collection("auditevents").deleteMany({});
  });

  afterEach(() => {
    resetAuditRecorderForTests();
    deleteNamedModel("Note");
    deleteNamedModel("AuditEvent");
  });

  it("writes a create event with after only and strips secrets", async () => {
    const app = buildApp();
    const agent = await authAsUser(app, "notAdmin");
    const created = await agent
      .post("/notes")
      .send({password: "hunter2", title: "Hello"})
      .expect(201);
    const admin = await authAsUser(app, "admin");
    const list = await admin.get("/audit-events").expect(200);
    assert.equal(list.body.data.length, 1);
    const event = list.body.data[0];
    assert.equal(event.verb, "created");
    assert.equal(event.operation, "create");
    assert.equal(event.source, "modelRouter");
    assert.equal(event.modelName, "Note");
    assert.equal(event.recordId, created.body.data._id);
    assert.equal(event.recordLabel, "Hello");
    assert.equal(event.after.title, "Hello");
    assert.isUndefined(event.before);
    assert.isUndefined(event.after.password);
  });

  it("PATCH title yields one event with before.title and after.title", async () => {
    const app = buildApp();
    const agent = await authAsUser(app, "notAdmin");
    const created = await agent.post("/notes").send({calories: 1, title: "One"}).expect(201);
    await agent.patch(`/notes/${created.body.data._id}`).send({title: "Two"}).expect(200);
    const admin = await authAsUser(app, "admin");
    const list = await admin.get("/audit-events?verb=updated").expect(200);
    assert.equal(list.body.data.length, 1);
    const event = list.body.data[0];
    assert.equal(event.before.title, "One");
    assert.equal(event.after.title, "Two");
    assert.isUndefined(event.before.calories);
    assert.isUndefined(event.after.calories);
  });

  it("strips ssn when redact includes ssn", async () => {
    const app = buildApp({redact: ["ssn"]});
    const agent = await authAsUser(app, "notAdmin");
    await agent.post("/notes").send({ssn: "123-45-6789", title: "Pii"}).expect(201);
    const admin = await authAsUser(app, "admin");
    const list = await admin.get("/audit-events").expect(200);
    assert.isUndefined(list.body.data[0].after.ssn);
    assert.equal(list.body.data[0].after.title, "Pii");
  });

  it("delete has before only", async () => {
    const app = buildApp();
    const agent = await authAsUser(app, "notAdmin");
    const created = await agent.post("/notes").send({title: "Gone"}).expect(201);
    await agent.delete(`/notes/${created.body.data._id}`).expect(204);
    const admin = await authAsUser(app, "admin");
    const list = await admin.get("/audit-events?verb=deleted").expect(200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].before.title, "Gone");
    assert.isUndefined(list.body.data[0].after);
  });

  it("still returns 201 when the recorder throws", async () => {
    const app = buildApp();
    const model = createAuditEventModel(mongoose.connection);
    const createSpy = spyOn(model, "create").mockImplementation(() => {
      throw new Error("disk full");
    });
    const agent = await authAsUser(app, "notAdmin");
    await agent.post("/notes").send({title: "Keep"}).expect(201);
    createSpy.mockRestore();
  });

  it("skips writes and logs once when AuditApp is omitted", async () => {
    const errorSpy = spyOn(logger, "error").mockImplementation(() => logger);
    const NoteModel = mongoose.model<Note>("Note", noteSchema);
    const app = new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    }).build();
    app.use("/notes", modelRouter(NoteModel, {audit: true, permissions: notePermissions}));
    const agent = await authAsUser(app, "notAdmin");
    await agent.post("/notes").send({title: "A"}).expect(201);
    await agent.post("/notes").send({title: "B"}).expect(201);
    assert.isUndefined(mongoose.connection.models.AuditEvent);
    const auditLogs = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes("requires AuditApp")
    );
    assert.equal(auditLogs.length, 1);
    errorSpy.mockRestore();
  });

  it("never writes an event for AuditEvent itself", async () => {
    const app = new TerrenoApp({skipListen: true, userModel: typedUserModel})
      .register(new AuditApp())
      .build();
    const model = createAuditEventModel(mongoose.connection);
    const beforeCount = await model.countDocuments();
    await maybeRecordModelRouterAudit({
      after: {modelName: "Todo"},
      audit: true,
      modelName: "AuditEvent",
      operation: "create",
      recordId: "1",
      req: {user: {id: new mongoose.Types.ObjectId().toString()}} as never,
      verb: "created",
    });
    assert.equal(await model.countDocuments(), beforeCount);
    const admin = await authAsUser(app, "admin");
    const list = await admin.get("/audit-events").expect(200);
    assert.equal(list.body.data.length, 0);
  });

  it("array push/update/remove each write one updated event with recordId", async () => {
    const app = buildApp();
    const agent = await authAsUser(app, "notAdmin");
    const created = await agent
      .post("/notes")
      .send({tags: ["a"], title: "Tagged"})
      .expect(201);
    const id = created.body.data._id;

    await agent.post(`/notes/${id}/tags`).send({tags: "b"}).expect(200);
    await agent.patch(`/notes/${id}/tags/a`).send({tags: "alpha"}).expect(200);
    await agent.delete(`/notes/${id}/tags/b`).expect(200);

    const admin = await authAsUser(app, "admin");
    const list = await admin.get("/audit-events").expect(200);
    const events = list.body.data.filter((row: {verb: string}) => row.verb === "updated");
    assert.equal(events.length, 3);
    const operations = events.map((row: {operation: string}) => row.operation).sort();
    assert.deepEqual(operations, ["arrayPush", "arrayRemove", "arrayUpdate"].sort());
    for (const event of events) {
      assert.equal(event.recordId, id);
      assert.equal(event.source, "modelRouter");
    }
  });
});
