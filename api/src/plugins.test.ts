import {beforeEach, describe, it, setSystemTime} from "bun:test";
import chai, {assert} from "chai";
import chaiAsPromised from "chai-as-promised";
import type express from "express";
import {type Document, type FilterQuery, type Model, model, Schema} from "mongoose";

import type {APIErrorConstructor} from "./errors";
import {Permissions} from "./permissions";

chai.use(chaiAsPromised);

import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {
  createdUpdatedPlugin,
  DateOnly,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
  upsertPlugin,
} from "./plugins";
import {authAsUser, getBaseServer, setupDb, UserModel} from "./tests";

interface Stuff {
  _id: string;
  name: string;
  ownerId: string;
  date: Date;
  created: Date;
  updated?: Date;
}

interface StuffModelType extends Model<Stuff> {
  findOneOrNone(
    query: FilterQuery<Stuff>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<(Document & Stuff) | null>;
  findExactlyOne(
    query: FilterQuery<Stuff>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<Document & Stuff>;
}

const stuffSchema = new Schema<Stuff>({
  date: DateOnly,
  name: String,
  ownerId: String,
});

stuffSchema.plugin(isDeletedPlugin);
stuffSchema.plugin(findOneOrNone);
stuffSchema.plugin(findExactlyOne);
stuffSchema.plugin(upsertPlugin);
stuffSchema.plugin(createdUpdatedPlugin);

const StuffModel = model<Stuff>("Stuff", stuffSchema) as unknown as StuffModelType;

describe("createdUpdate", () => {
  it("sets created and updated on save", async () => {
    setSystemTime(new Date("2022-12-17T03:24:00.000Z"));

    const stuff = await StuffModel.create({name: "Things", ownerId: "123"});
    assert.isNotNull(stuff.created);
    assert.isNotNull(stuff.updated);
    assert.equal(stuff.created.toISOString(), "2022-12-17T03:24:00.000Z");
    assert.equal(stuff.updated?.toISOString(), "2022-12-17T03:24:00.000Z");

    stuff.name = "Thangs";
    // Advance time by 10 seconds
    setSystemTime(new Date("2022-12-17T03:24:10.000Z"));
    await stuff.save();
    assert.equal(stuff.created.toISOString(), "2022-12-17T03:24:00.000Z");
    assert.isTrue(stuff.updated && stuff.updated > stuff.created);
    setSystemTime();
  });
});

describe("isDeleted", () => {
  beforeEach(async () => {
    await StuffModel.deleteMany({});
    await Promise.all([
      StuffModel.create({
        deleted: true,
        name: "Things",
        ownerId: "123",
      }),
      StuffModel.create({
        name: "StuffNThings",
        ownerId: "123",
      }),
    ]);
  });

  it('filters out deleted documents from "find"', async () => {
    let stuff = await StuffModel.find({});
    assert.lengthOf(stuff, 1);
    assert.equal(stuff[0].name, "StuffNThings");
    // Providing deleted in query should return deleted documents:
    stuff = await StuffModel.find({deleted: true});
    assert.lengthOf(stuff, 1);
    assert.equal(stuff[0].name, "Things");
  });

  it('filters out deleted documents from "findOne"', async () => {
    let stuff = await StuffModel.findOne({});
    assert.equal(stuff?.name, "StuffNThings");
    // Providing deleted in query should return deleted document:
    stuff = await StuffModel.findOne({deleted: true});
    assert.equal(stuff?.name, "Things");
  });
});

describe("findOneOrNone", () => {
  let things: any;

  beforeEach(async () => {
    await StuffModel.deleteMany({});
    await setupDb();

    [things] = await Promise.all([
      StuffModel.create({
        name: "Things",
        ownerId: "123",
      }),
      StuffModel.create({
        name: "StuffNThings",
        ownerId: "123",
      }),
    ]);
  });

  it("returns null with no matches.", async () => {
    const result = await StuffModel.findOneOrNone({name: "OtherStuff"});
    assert.isNull(result);
  });

  it("returns a single match", async () => {
    const result = await StuffModel.findOneOrNone({name: "Things"});
    assert.isNotNull(result);
    assert.equal(result?._id.toString(), things._id.toString());
  });

  it("throws error with two matches.", async () => {
    const fn = () => StuffModel.findOneOrNone({ownerId: "123"});
    await assert.isRejected(fn(), /Stuff\.findOne query returned multiple documents/);
  });

  it("throws custom error with two matches.", async () => {
    const fn = () => StuffModel.findOneOrNone({ownerId: "123"}, {status: 400, title: "Oh no!"});

    try {
      await fn();
      // If the promise doesn't reject, the test should fail
      assert.fail("Expected promise to reject");
    } catch (error: any) {
      // Check if the error has title and status properties
      assert.equal(error.title, "Oh no!");
      assert.equal(error.status, 400);
      assert.equal(error.detail, 'query: {"ownerId":"123"}');
    }
  });
});

describe("findExactlyOne", () => {
  let things: any;

  beforeEach(async () => {
    await StuffModel.deleteMany({});
    await setupDb();

    [things] = await Promise.all([
      StuffModel.create({
        name: "Things",
        ownerId: "123",
      }),
      StuffModel.create({
        name: "StuffNThings",
        ownerId: "123",
      }),
    ]);
  });

  it("throws error with no matches.", async () => {
    const fn = () => StuffModel.findExactlyOne({name: "OtherStuff"});
    await assert.isRejected(fn(), /Stuff\.findExactlyOne query returned no documents/);
  });

  it("returns a single match", async () => {
    const result = await StuffModel.findExactlyOne({name: "Things"});
    assert.equal(result._id.toString(), things._id.toString());
  });

  it("throws error with two matches.", async () => {
    const fn = () => StuffModel.findExactlyOne({ownerId: "123"});
    await assert.isRejected(fn(), /Stuff\.findExactlyOne query returned multiple documents/);
  });

  it("throws custom error with two matches.", async () => {
    const fn = () => StuffModel.findExactlyOne({ownerId: "123"}, {status: 400, title: "Oh no!"});

    try {
      await fn();
      // If the promise doesn't reject, the test should fail
      assert.fail("Expected promise to reject");
    } catch (error: any) {
      // Check if the error has title and status properties
      assert.equal(error.title, "Oh no!");
      assert.equal(error.status, 400);
      assert.equal(error.detail, 'query: {"ownerId":"123"}');
    }
  });
});

describe("upsertPlugin", () => {
  beforeEach(async () => {
    await StuffModel.deleteMany({});
    await setupDb();
  });

  it("creates a new document when none exists", async () => {
    const result = await (StuffModel as any).upsert({name: "NewThing"}, {ownerId: "456"});
    assert.equal(result.name, "NewThing");
    assert.equal(result.ownerId, "456");

    const found = await StuffModel.findOne({name: "NewThing"});
    assert.isNotNull(found);
    assert.equal(found?.ownerId, "456");
  });

  it("updates existing document when one exists", async () => {
    const initial = await StuffModel.create({
      name: "ExistingThing",
      ownerId: "123",
    });

    const result = await (StuffModel as any).upsert({name: "ExistingThing"}, {ownerId: "789"});

    assert.equal(result._id.toString(), initial._id.toString());
    assert.equal(result.ownerId, "789");

    const allDocs = await StuffModel.find({name: "ExistingThing"});
    assert.lengthOf(allDocs, 1);
    assert.equal(allDocs[0].ownerId, "789");
  });

  it("throws error when multiple documents match conditions", async () => {
    await Promise.all([
      StuffModel.create({name: "Thing1", ownerId: "123"}),
      StuffModel.create({name: "Thing2", ownerId: "123"}),
    ]);

    const fn = () => (StuffModel as any).upsert({ownerId: "123"}, {name: "Updated"});
    await assert.isRejected(fn(), /Stuff\.upsert find query returned multiple documents/);
  });

  it("combines conditions and update data for new documents", async () => {
    const result = await (StuffModel as any).upsert({name: "TestCondition"}, {ownerId: "999"});

    assert.equal(result.name, "TestCondition");
    assert.equal(result.ownerId, "999");
  });
});

describe("TypeScript return types", () => {
  let _things: any;

  beforeEach(async () => {
    await StuffModel.deleteMany({});
    await setupDb();

    [_things] = await Promise.all([
      StuffModel.create({
        date: new Date("2023-01-01"),
        name: "Things",
        ownerId: "123",
      }),
      StuffModel.create({
        date: new Date("2023-01-02"),
        name: "StuffNThings",
        ownerId: "123",
      }),
    ]);
  });

  it("findOneOrNone returns properly typed document or null", async () => {
    const result = await StuffModel.findOneOrNone({name: "Things"});

    if (result) {
      assert.isString(result._id.toString());
      assert.isString(result.name);
      assert.isString(result.ownerId);
      assert.instanceOf(result.date, Date);
    } else {
      assert.isNull(result);
    }
  });

  it("findExactlyOne returns properly typed document", async () => {
    const result = await StuffModel.findExactlyOne({name: "Things"});

    assert.isString(result._id.toString());
    assert.isString(result.name);
    assert.isString(result.ownerId);
    assert.instanceOf(result.date, Date);
  });
});
describe("DateOnly", () => {
  it("throws error with invalid date", async () => {
    try {
      await StuffModel.create({
        date: "foo" as any,
        name: "Things",
        ownerId: "123",
      });
    } catch (error: any) {
      assert.match(error.message, /Cast to DateOnly failed/);
      return;
    }
    assert.fail("Expected error was not thrown");
  });

  it("adjusts date to date only", async () => {
    const res = await StuffModel.create({
      date: "2005-10-10T17:17:17.017Z",
      name: "Things",
      ownerId: "123",
    });
    assert.strictEqual(res.date.toISOString(), "2005-10-10T00:00:00.000Z");
  });

  it("filter on date only", async () => {
    await StuffModel.create({
      date: "2000-10-10T17:17:17.017Z",
      name: "Things",
      ownerId: "123",
    });
    let found = await StuffModel.findOne({
      date: {
        $gte: "2000-01-01T00:00:00.000Z",
        $lt: "2001-01-01T00:00:00.000Z",
      },
    });
    assert.strictEqual(found?.date.toISOString(), "2000-10-10T00:00:00.000Z");
    found = await StuffModel.findOne({
      date: {
        $gte: "2000-01-01T12:12:12.000Z",
        $lt: "2001-01-01T12:12:12.000Z",
      },
    });
    assert.strictEqual(found?.date.toISOString(), "2000-10-10T00:00:00.000Z");
  });

  describe("handle 404", () => {
    let agent: TestAgent;
    let app: express.Application;

    beforeEach(async () => {
      await setupDb();
      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
      app.use(
        "/stuff",
        modelRouter(StuffModel, {
          allowAnonymous: true,
          permissions: {
            create: [Permissions.IsAny],
            delete: [Permissions.IsAny],
            list: [Permissions.IsAny],
            read: [Permissions.IsAny],
            update: [Permissions.IsAny],
          },
        })
      );
      supertest(app);
      agent = await authAsUser(app, "notAdmin");
    });

    it("returns 404 with context for hidden document", async () => {
      const doc = await StuffModel.create({deleted: true, name: "test"});
      const res = await agent.get(`/stuff/${doc._id}`).expect(404);
      assert.equal(res.body.title, `Document ${doc._id} not found for model Stuff`);
      assert.deepEqual(res.body.meta, {deleted: "true"});
    });

    it("returns 404 without meta for missing document", async () => {
      const nonExistentId = "507f1f77bcf86cd799439011";
      const res = await agent.get(`/stuff/${nonExistentId}`).expect(404);
      assert.equal(res.body.title, `Document ${nonExistentId} not found for model Stuff`);
      assert.isUndefined(res.body.meta);
    });
  });
});
