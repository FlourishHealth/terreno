import {afterEach, beforeEach, describe, it, spyOn} from "bun:test";
import * as Sentry from "@sentry/bun";
import {assert} from "chai";
import type express from "express";
import mongoose from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {type ModelRouterOptions, modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {Permissions} from "./permissions";
import {type Food, FoodModel, getBaseServer, setupDb, UserModel} from "./tests";

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
    assert.include(res.body.title, "populate exploded");
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
    assert.include(res.body.title, "deleteOne exploded");
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
    assert.include(res.body.title, "transform exploded");
  });

  it("wraps save failures during array operations", async () => {
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
    assert.include(res.body.title, "PATCH Pre Update error");
  });
});
