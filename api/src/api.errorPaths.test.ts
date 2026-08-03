import {afterEach, beforeEach, describe, it, spyOn} from "bun:test";
import * as Sentry from "@sentry/bun";
import {assert} from "chai";
import type express from "express";
import mongoose from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {type ModelRouterOptions, modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {ConflictError} from "./errors";
import {Permissions} from "./permissions";
import {type Food, FoodModel, getBaseServer, RequiredModel, setupDb, UserModel} from "./tests";

type SetupAuthUserModel = Parameters<typeof setupAuth>[1];
const authUserModel = UserModel as unknown as SetupAuthUserModel;

interface RestorableSpy {
  mockRestore?: () => void;
}

const anyPermissions = {
  create: [Permissions.IsAny],
  delete: [Permissions.IsAny],
  list: [Permissions.IsAny],
  read: [Permissions.IsAny],
  update: [Permissions.IsAny],
};

describe("modelRouter error paths", () => {
  let app: express.Application;
  let server: TestAgent;

  beforeEach(async () => {
    await setupDb();
    app = getBaseServer();
    setupAuth(app, authUserModel);
    addAuthRoutes(app, authUserModel);
  });

  afterEach(() => {
    // Restore any spies installed on the shared FoodModel / Sentry.
    (FoodModel.find as unknown as RestorableSpy).mockRestore?.();
    (FoodModel.findById as unknown as RestorableSpy).mockRestore?.();
    (Sentry.captureMessage as unknown as RestorableSpy).mockRestore?.();
  });

  const mountFood = (options: Partial<ModelRouterOptions<Food>> = {}): void => {
    app.use(
      "/food",
      modelRouter(FoodModel, {
        allowAnonymous: true,
        permissions: anyPermissions,
        ...options,
      })
    );
    server = supertest(app);
  };

  it("wraps populate failures on create in a Populate error", async () => {
    mountFood({populatePaths: [{fields: ["email"], path: "ownerId"}]});

    // Creation succeeds, but the follow-up populate query rejects.
    const rejectingQuery = {
      exec: () => Promise.reject(new Error("populate exploded")),
      populate() {
        return this;
      },
    };
    spyOn(FoodModel, "findById").mockReturnValue(
      rejectingQuery as unknown as ReturnType<typeof FoodModel.findById>
    );

    const res = await server
      .post("/food")
      .send({calories: 5, name: "Broccoli", ownerId: new mongoose.Types.ObjectId()})
      .expect(400);
    assert.include(res.body.title, "Populate error");
    assert.include(res.body.detail, "populate exploded");
  });

  it("wraps list query failures in a List error", async () => {
    mountFood();

    const rejectingQuery = {
      exec: () => Promise.reject(new Error("list exploded")),
      limit() {
        return this;
      },
    };
    spyOn(FoodModel, "find").mockReturnValue(
      rejectingQuery as unknown as ReturnType<typeof FoodModel.find>
    );

    const res = await server.get("/food").expect(500);
    assert.include(res.body.title, "List error");
  });

  it("swallows Sentry failures when warning about truncated unpaginated lists", async () => {
    mountFood({defaultLimit: 1});
    const ownerId = new mongoose.Types.ObjectId();
    await FoodModel.create([
      {calories: 1, name: "A", ownerId} as Partial<Food>,
      {calories: 2, name: "B", ownerId} as Partial<Food>,
    ]);

    const captureSpy = spyOn(Sentry, "captureMessage").mockImplementation(() => {
      throw new Error("sentry down");
    });

    const res = await server.get("/food").expect(200);
    // The extra document is sliced off so only `limit` rows are returned.
    assert.lengthOf(res.body.data, 1);
    assert.isTrue(res.body.more);
    assert.isAbove(captureSpy.mock.calls.length, 0);
  });

  it("wraps deleteOne failures for models without soft delete", async () => {
    const brittleSchema = new mongoose.Schema(
      {name: {description: "The name", type: String}},
      {strict: "throw"}
    );
    brittleSchema.pre("deleteOne", {document: true, query: false}, () => {
      throw new Error("deleteOne exploded");
    });
    const BrittleModel = mongoose.model(`BrittleDelete_${Date.now()}`, brittleSchema);

    app.use(
      "/brittle",
      modelRouter(BrittleModel, {allowAnonymous: true, permissions: anyPermissions})
    );
    server = supertest(app);

    const created = await BrittleModel.create({name: "doomed"});
    const res = await server.delete(`/brittle/${created._id}`).expect(400);
    assert.equal(res.body.title, "Delete error");
    assert.include(res.body.detail, "deleteOne exploded");
  });

  it("wraps non-APIError transformer failures during array operations", async () => {
    mountFood({
      transformer: {
        transform: () => {
          throw new Error("transform exploded");
        },
      },
    });
    const food = await FoodModel.create({
      calories: 1,
      name: "Tagged",
      ownerId: new mongoose.Types.ObjectId(),
    } as Partial<Food>);

    const res = await server.post(`/food/${food._id}/tags`).send({tags: "vegetable"}).expect(403);
    assert.equal(res.body.title, "Transform error");
    assert.include(res.body.detail, "transform exploded");
  });

  it("converts Mongoose save failures during array operations into field errors", async () => {
    mountFood();
    const food = await FoodModel.create({
      calories: 1,
      name: "Eaten",
      ownerId: new mongoose.Types.ObjectId(),
    } as Partial<Food>);

    // eatenBy is an ObjectId array, so pushing an unparseable id fails on save.
    const res = await server
      .post(`/food/${food._id}/eatenBy`)
      .send({eatenBy: "not-an-object-id"})
      .expect(400);
    assert.equal(res.body.title, "Validation failed");
    assert.include(res.body.meta.fields["eatenBy.0"], "ObjectId");
  });

  it("wraps non-Mongoose save failures during array operations", async () => {
    mountFood();
    const food = await FoodModel.create({
      calories: 1,
      name: "Unsavable",
      ownerId: new mongoose.Types.ObjectId(),
    } as Partial<Food>);

    const saveSpy = spyOn(FoodModel.prototype, "save").mockImplementation(() => {
      throw new Error("save exploded");
    });
    try {
      const res = await server.post(`/food/${food._id}/tags`).send({tags: "vegetable"}).expect(400);
      assert.include(res.body.title, "PATCH Pre Update error");
      assert.include(res.body.detail, "save exploded");
    } finally {
      saveSpy.mockRestore();
    }
  });
});

interface Guarded {
  name: string;
  tags: string[];
}

// A domain error of the shape consumers throw: stable title, kebab-case code, per-occurrence
// detail, and structured meta the client renders.
const staffConflictError = (code: string): ConflictError =>
  new ConflictError({
    code,
    detail: "Conflict detected for Dr. Ada on 2026-07-31",
    meta: {date: "2026-07-31", staff: "Dr. Ada"},
    title: "Conflict detected",
  });

const assertStaffConflict = (body: Record<string, unknown>, code: string): void => {
  assert.equal(body.status, 409);
  assert.equal(body.title, "Conflict detected");
  assert.equal(body.detail, "Conflict detected for Dr. Ada on 2026-07-31");
  assert.equal(body.code, code);
  assert.deepEqual(body.meta, {date: "2026-07-31", staff: "Dr. Ada"});
};

const guardedSchema = new mongoose.Schema<Guarded>(
  {
    name: {description: "The name", type: String},
    tags: {description: "Tags for the document", type: [String]},
  },
  {strict: "throw"}
);

// Stands in for a consumer model that validates in document middleware.
guardedSchema.pre("save", function () {
  if (this.name === "Conflict" || this.tags?.includes("conflict")) {
    throw staffConflictError("schedule-item-staff-conflict");
  }
  if (this.name === "Boom" || this.tags?.includes("boom")) {
    throw new Error("save exploded");
  }
});

const GuardedModel = mongoose.model<Guarded>("PassthroughGuarded", guardedSchema);

describe("modelRouter APIError passthrough", () => {
  let app: express.Application;
  let server: TestAgent;

  beforeEach(async () => {
    await setupDb();
    await GuardedModel.deleteMany({});
    app = getBaseServer();
    setupAuth(app, authUserModel);
    addAuthRoutes(app, authUserModel);
  });

  const mountGuarded = (options: Partial<ModelRouterOptions<Guarded>> = {}): void => {
    app.use(
      "/guarded",
      modelRouter(GuardedModel, {
        allowAnonymous: true,
        permissions: anyPermissions,
        ...options,
      })
    );
    server = supertest(app);
  };

  describe("Mongoose document middleware", () => {
    it("keeps an APIError from pre(save) intact through POST /", async () => {
      mountGuarded();
      const res = await server.post("/guarded").send({name: "Conflict"}).expect(409);
      assertStaffConflict(res.body, "schedule-item-staff-conflict");
    });

    it("wraps a non-APIError from pre(save) on POST /", async () => {
      mountGuarded();
      const res = await server.post("/guarded").send({name: "Boom"}).expect(400);
      assert.equal(res.body.title, "Create error");
      assert.equal(res.body.code, "create-error");
      assert.include(res.body.detail, "save exploded");
    });

    it("keeps an APIError from pre(save) intact through PATCH /:id", async () => {
      mountGuarded();
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.patch(`/guarded/${doc._id}`).send({name: "Conflict"}).expect(409);
      assertStaffConflict(res.body, "schedule-item-staff-conflict");
    });

    it("wraps a non-APIError from pre(save) on PATCH /:id", async () => {
      mountGuarded();
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.patch(`/guarded/${doc._id}`).send({name: "Boom"}).expect(400);
      assert.equal(res.body.title, "preUpdate hook save error");
      assert.include(res.body.detail, "save exploded");
    });

    it("keeps an APIError from pre(save) intact through an array operation", async () => {
      mountGuarded();
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server
        .post(`/guarded/${doc._id}/tags`)
        .send({tags: "conflict"})
        .expect(409);
      assertStaffConflict(res.body, "schedule-item-staff-conflict");
    });

    it("surfaces Mongoose validation errors from create as per-field errors", async () => {
      app.use(
        "/required",
        modelRouter(RequiredModel, {allowAnonymous: true, permissions: anyPermissions})
      );
      server = supertest(app);

      const res = await server.post("/required").send({about: "no name here"}).expect(400);
      assert.equal(res.body.title, "Validation failed");
      assert.include(res.body.meta.fields.name, "required");
      assert.isTrue(res.body.disableExternalErrorTracking);
    });
  });

  describe("hooks", () => {
    it("keeps an APIError from queryFilter intact", async () => {
      mountGuarded({
        queryFilter: () => {
          throw staffConflictError("query-filter-conflict");
        },
      });
      const res = await server.get("/guarded").expect(409);
      assertStaffConflict(res.body, "query-filter-conflict");
    });

    it("wraps a non-APIError from queryFilter with the caught error's message", async () => {
      mountGuarded({
        queryFilter: () => {
          throw new Error("filter exploded");
        },
      });
      const res = await server.get("/guarded").expect(400);
      assert.equal(res.body.title, "Query filter error");
      // Previously String(error), which prefixed the class name.
      assert.equal(res.body.detail, "filter exploded");
    });

    it("wraps a thrown non-Error from queryFilter", async () => {
      mountGuarded({
        queryFilter: () => {
          throw "filter string";
        },
      });
      const res = await server.get("/guarded").expect(400);
      assert.equal(res.body.title, "Query filter error");
      assert.equal(res.body.detail, "filter string");
    });

    it("keeps an APIError from responseHandler intact for every method", async () => {
      mountGuarded({
        responseHandler: () => {
          throw staffConflictError("response-handler-conflict");
        },
      });
      const doc = await GuardedModel.create({name: "Fine", tags: []});

      for (const request of [
        server.post("/guarded").send({name: "Another"}),
        server.get("/guarded"),
        server.get(`/guarded/${doc._id}`),
        server.patch(`/guarded/${doc._id}`).send({name: "Renamed"}),
      ]) {
        const res = await request.expect(409);
        assertStaffConflict(res.body, "response-handler-conflict");
      }
    });

    it("wraps a non-APIError from responseHandler", async () => {
      mountGuarded({
        responseHandler: () => {
          throw new Error("serialize exploded");
        },
      });
      const res = await server.get("/guarded").expect(500);
      assert.equal(res.body.title, "responseHandler error");
      assert.include(res.body.detail, "serialize exploded");
    });

    it("keeps an APIError from postCreate intact", async () => {
      mountGuarded({
        postCreate: () => {
          throw staffConflictError("post-create-conflict");
        },
      });
      const res = await server.post("/guarded").send({name: "Fine"}).expect(409);
      assertStaffConflict(res.body, "post-create-conflict");
    });

    it("wraps a non-APIError from postCreate", async () => {
      mountGuarded({
        postCreate: () => {
          throw new Error("postCreate exploded");
        },
      });
      const res = await server.post("/guarded").send({name: "Fine"}).expect(400);
      assert.equal(res.body.title, "postCreate hook error");
      assert.include(res.body.detail, "postCreate exploded");
    });

    it("keeps an APIError from postUpdate intact", async () => {
      mountGuarded({
        postUpdate: () => {
          throw staffConflictError("post-update-conflict");
        },
      });
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.patch(`/guarded/${doc._id}`).send({name: "Renamed"}).expect(409);
      assertStaffConflict(res.body, "post-update-conflict");
    });

    it("wraps a non-APIError from postUpdate", async () => {
      mountGuarded({
        postUpdate: () => {
          throw new Error("postUpdate exploded");
        },
      });
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.patch(`/guarded/${doc._id}`).send({name: "Renamed"}).expect(400);
      assert.equal(res.body.title, "postUpdate hook error");
      assert.include(res.body.detail, "postUpdate exploded");
    });

    it("keeps an APIError from postDelete intact", async () => {
      mountGuarded({
        postDelete: () => {
          throw staffConflictError("post-delete-conflict");
        },
      });
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.delete(`/guarded/${doc._id}`).expect(409);
      assertStaffConflict(res.body, "post-delete-conflict");
    });

    it("wraps a non-APIError from postDelete", async () => {
      mountGuarded({
        postDelete: () => {
          throw new Error("postDelete exploded");
        },
      });
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.delete(`/guarded/${doc._id}`).expect(400);
      assert.equal(res.body.title, "postDelete hook error");
      assert.include(res.body.detail, "postDelete exploded");
    });

    it("keeps an APIError from preUpdate intact during an array operation", async () => {
      mountGuarded({
        preUpdate: () => {
          throw staffConflictError("array-pre-update-conflict");
        },
      });
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.post(`/guarded/${doc._id}/tags`).send({tags: "healthy"}).expect(409);
      assertStaffConflict(res.body, "array-pre-update-conflict");
    });

    it("keeps an APIError from postUpdate intact during an array operation", async () => {
      mountGuarded({
        postUpdate: () => {
          throw staffConflictError("array-post-update-conflict");
        },
      });
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.post(`/guarded/${doc._id}/tags`).send({tags: "healthy"}).expect(409);
      assertStaffConflict(res.body, "array-post-update-conflict");
    });

    it("wraps a non-APIError from preUpdate during an array operation", async () => {
      mountGuarded({
        preUpdate: () => {
          throw new Error("array preUpdate exploded");
        },
      });
      const doc = await GuardedModel.create({name: "Fine", tags: []});
      const res = await server.post(`/guarded/${doc._id}/tags`).send({tags: "healthy"}).expect(400);
      assert.equal(res.body.title, "preUpdate hook error");
      assert.include(res.body.detail, "array preUpdate exploded");
    });
  });
});
