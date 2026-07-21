// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import mongoose from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {Permissions} from "./permissions";
import {type Food, FoodModel, getBaseServer, setupDb, UserModel} from "./tests";

// A model without the isDeleted plugin so deletes call doc.deleteOne(). The
// document delete hook throws to exercise the hard-delete error branch.
const explosiveSchema = new mongoose.Schema<{name: string}>({
  name: {description: "The name of the item", type: String},
});
explosiveSchema.pre("deleteOne", {document: true, query: false}, () => {
  throw new Error("deleteOne exploded");
});
const ExplosiveModel = mongoose.model<{name: string}>("ExplosiveCoverage", explosiveSchema);

describe("modelRouter error path coverage", () => {
  let server: TestAgent;
  let app: express.Application;
  let admin: any;
  let apple: Food;

  beforeEach(async () => {
    [admin] = await setupDb();

    apple = await FoodModel.create({
      calories: 100,
      categories: [
        {name: "Fruit", show: true},
        {name: "Popular", show: false},
      ],
      created: new Date("2021-12-03T00:00:30.000Z"),
      hidden: false,
      name: "Apple",
      ownerId: admin._id,
      tags: ["healthy", "cheap"],
    });

    app = getBaseServer();
    setupAuth(app, UserModel as any);
    addAuthRoutes(app, UserModel as any);
  });

  it("returns 400 when an array operation transformer throws a non-APIError", async () => {
    app.use(
      "/food",
      modelRouter(FoodModel, {
        allowAnonymous: true,
        permissions: {
          create: [Permissions.IsAny],
          delete: [Permissions.IsAny],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAny],
        },
        transformer: {
          transform: () => {
            throw new Error("array transform boom");
          },
        },
      })
    );
    server = supertest(app);

    const res = await server.post(`/food/${apple._id}/tags`).send({tags: "organic"}).expect(403);
    expect(res.body.title).toContain("array transform boom");
  });

  it("returns 400 when saving an array operation fails validation", async () => {
    app.use(
      "/food",
      modelRouter(FoodModel, {
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
    server = supertest(app);

    // eatenBy is an ObjectId array; pushing a non-ObjectId value fails the
    // cast when the document is saved.
    const res = await server
      .post(`/food/${apple._id}/eatenBy`)
      .send({eatenBy: "not-an-object-id"})
      .expect(400);
    expect(res.body.title).toContain("PATCH Pre Update error");
  });

  it("returns 400 when a hard delete (no isDeleted plugin) fails", async () => {
    const doc = await ExplosiveModel.create({name: "boom"});
    app.use(
      "/explosive",
      modelRouter(ExplosiveModel as any, {
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
    server = supertest(app);

    const res = await server.delete(`/explosive/${doc._id}`).expect(400);
    expect(res.body.title).toContain("deleteOne exploded");
  });
});
