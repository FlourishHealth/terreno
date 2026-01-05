import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import type {ObjectId} from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {Permissions} from "./permissions";
import {authAsUser, type Food, FoodModel, getBaseServer, setupDb, UserModel} from "./tests";
import {AdminOwnerTransformer} from "./transformers";

describe("query and transform", () => {
  let notAdmin: any;
  let admin: any;
  let server: TestAgent;
  let app: express.Application;

  beforeEach(async () => {
    process.env.REFRESH_TOKEN_SECRET = "testsecret1234";

    [admin, notAdmin] = await setupDb();

    await Promise.all([
      FoodModel.create({
        calories: 1,
        created: new Date(),
        name: "Spinach",
        ownerId: notAdmin._id,
      }),
      FoodModel.create({
        calories: 100,
        created: Date.now() - 10,
        hidden: true,
        name: "Apple",
        ownerId: admin._id,
      }),
      FoodModel.create({
        calories: 100,
        created: Date.now() - 10,
        name: "Carrots",
        ownerId: admin._id,
      }),
    ]);
    app = getBaseServer();
    setupAuth(app, UserModel as any);
    addAuthRoutes(app, UserModel as any);
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
        queryFilter: (user?: {_id: ObjectId | string; admin: boolean}) => {
          if (!user?.admin) {
            return {hidden: {$ne: true}};
          }
          return {};
        },
        transformer: AdminOwnerTransformer<Food>({
          adminReadFields: ["name", "calories", "created", "ownerId"],
          adminWriteFields: ["name", "calories", "created", "ownerId"],
          anonReadFields: ["name"],
          anonWriteFields: [],
          authReadFields: ["name", "calories", "created"],
          authWriteFields: ["name", "calories"],
          ownerReadFields: ["name", "calories", "created", "ownerId"],
          ownerWriteFields: ["name", "calories", "created"],
        }),
      })
    );
    server = supertest(app);
  });

  it("filters list for non-admin", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const foodRes = await agent.get("/food").expect(200);
    expect(foodRes.body.data).toHaveLength(2);
  });

  it("does not filter list for admin", async () => {
    const agent = await authAsUser(app, "admin");
    const foodRes = await agent.get("/food").expect(200);
    expect(foodRes.body.data).toHaveLength(3);
  });

  it("admin read transform", async () => {
    const agent = await authAsUser(app, "admin");
    const foodRes = await agent.get("/food").expect(200);
    expect(foodRes.body.data).toHaveLength(3);
    const spinach = foodRes.body.data.find((food: Food) => food.name === "Spinach");
    expect(spinach.created).toBeDefined();
    expect(spinach.id).toBeDefined();
    expect(spinach.ownerId).toBeDefined();
    expect(spinach.name).toBe("Spinach");
    expect(spinach.calories).toBe(1);
    expect(spinach.hidden).toBeUndefined();
  });

  it("admin write transform", async () => {
    const agent = await authAsUser(app, "admin");
    const foodRes = await agent.get("/food").expect(200);
    const spinach = foodRes.body.data.find((food: Food) => food.name === "Spinach");
    const spinachRes = await agent.patch(`/food/${spinach.id}`).send({name: "Lettuce"}).expect(200);
    expect(spinachRes.body.data.name).toBe("Lettuce");
  });

  it("owner read transform", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const foodRes = await agent.get("/food").expect(200);
    expect(foodRes.body.data).toHaveLength(2);
    const spinach = foodRes.body.data.find((food: Food) => food.name === "Spinach");
    expect(spinach.id).toBeDefined();
    expect(spinach.name).toBe("Spinach");
    expect(spinach.calories).toBe(1);
    expect(spinach.created).toBeDefined();
    expect(spinach.ownerId).toBeDefined();
    expect(spinach.hidden).toBeUndefined();
  });

  it("owner write transform", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const foodRes = await agent.get("/food").expect(200);
    const spinach = foodRes.body.data.find((food: Food) => food.name === "Spinach");
    await agent.patch(`/food/${spinach.id}`).send({ownerId: admin.id}).expect(403);
  });

  it("owner write transform fails", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const foodRes = await agent.get("/food").expect(200);
    const spinach = foodRes.body.data.find((food: Food) => food.name === "Spinach");
    const spinachRes = await agent
      .patch(`/food/${spinach.id}`)
      .send({ownerId: notAdmin.id})
      .expect(403);
    expect(spinachRes.body.title.includes("User of type owner cannot write fields: ownerId")).toBe(
      true
    );
  });

  it("auth read transform", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const foodRes = await agent.get("/food").expect(200);
    expect(foodRes.body.data).toHaveLength(2);
    const spinach = foodRes.body.data.find((food: Food) => food.name === "Spinach");
    expect(spinach.id).toBeDefined();
    expect(spinach.name).toBe("Spinach");
    expect(spinach.calories).toBe(1);
    expect(spinach.created).toBeDefined();
    // Owner, so this is defined.
    expect(spinach.ownerId).toBeDefined();
    expect(spinach.hidden).toBeUndefined();

    const carrots = foodRes.body.data.find((food: Food) => food.name === "Carrots");
    expect(carrots.id).toBeDefined();
    expect(carrots.name).toBe("Carrots");
    expect(carrots.calories).toBe(100);
    expect(carrots.created).toBeDefined();
    // Not owner, so undefined.
    expect(carrots.ownerId).toBeUndefined();
    expect(spinach.hidden).toBeUndefined();
  });

  it("auth write transform", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const foodRes = await agent.get("/food");
    const carrots = foodRes.body.data.find((food: Food) => food.name === "Carrots");
    const carrotRes = await agent.patch(`/food/${carrots.id}`).send({calories: 2000}).expect(200);
    expect(carrotRes.body.data.calories).toBe(2000);
  });

  it("auth write transform fail", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const foodRes = await agent.get("/food");
    const carrots = foodRes.body.data.find((food: Food) => food.name === "Carrots");
    const writeRes = await agent
      .patch(`/food/${carrots.id}`)
      .send({created: "2020-01-01T00:00:00Z"})
      .expect(403);
    expect(writeRes.body.title.includes("User of type auth cannot write fields: created")).toBe(
      true
    );
  });

  it("anon read transform", async () => {
    const res = await server.get("/food");
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.find((f: Food) => f.name === "Spinach")).toBeDefined();
    expect(res.body.data.find((f: Food) => f.name === "Carrots")).toBeDefined();
  });

  it("anon write transform fails", async () => {
    const foodRes = await server.get("/food");
    const carrots = foodRes.body.data.find((food: Food) => food.name === "Carrots");
    await server.patch(`/food/${carrots.id}`).send({calories: 10}).expect(403);
  });
});
