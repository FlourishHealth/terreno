import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {OwnerQueryFilter, Permissions} from "./permissions";
import {
  authAsUser,
  type Food,
  FoodModel,
  getBaseServer,
  RequiredModel,
  setupDb,
  UserModel,
} from "./tests";

describe("permissions", () => {
  let server: TestAgent;
  let app: express.Application;

  beforeEach(async () => {
    process.env.REFRESH_TOKEN_SECRET = "testsecret1234";

    const [admin, notAdmin] = await setupDb();

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
        name: "Apple",
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
          create: [Permissions.IsAuthenticated],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsOwner],
        },
      })
    );
    app.use(
      "/required",
      modelRouter(RequiredModel, {
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsOwner],
        },
      })
    );
    server = supertest(app);
  });

  describe("anonymous food", () => {
    it("list", async () => {
      const res = await server.get("/food").expect(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("get", async () => {
      const res = await server.get("/food").expect(200);
      expect(res.body.data).toHaveLength(2);
      const res2 = await server.get(`/food/${res.body.data[0]._id}`).expect(200);
      expect(res.body.data[0]._id).toBe(res2.body.data._id);
    });

    it("post", async () => {
      const res = await server.post("/food").send({
        calories: 15,
        name: "Broccoli",
      });
      expect(res.status).toBe(405);
    });

    it("patch", async () => {
      const res = await server.get("/food");
      const res2 = await server.patch(`/food/${res.body.data[0]._id}`).send({
        name: "Broccoli",
      });
      expect(res2.status).toBe(403);
    });

    it("delete", async () => {
      const res = await server.get("/food");
      const res2 = await server.delete(`/food/${res.body.data[0]._id}`);
      expect(res2.status).toBe(405);
    });
  });

  describe("non admin food", () => {
    let agent: TestAgent;

    beforeEach(async () => {
      agent = await authAsUser(app, "notAdmin");
    });

    it("list", async () => {
      const res = await agent.get("/food").expect(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("get", async () => {
      const res = await agent.get("/food").expect(200);
      expect(res.body.data).toHaveLength(2);
      const res2 = await server.get(`/food/${res.body.data[0]._id}`).expect(200);
      expect(res.body.data[0]._id).toBe(res2.body.data._id);
    });

    it("post", async () => {
      await agent
        .post("/food")
        .send({
          calories: 15,
          name: "Broccoli",
        })
        .expect(201);
    });

    it("patch own item", async () => {
      const res = await agent.get("/food");
      const spinach = res.body.data.find((food: Food) => food.name === "Spinach");
      const res2 = await agent
        .patch(`/food/${spinach._id}`)
        .send({
          name: "Broccoli",
        })
        .expect(200);
      expect(res2.body.data.name).toBe("Broccoli");
    });

    it("patch other item", async () => {
      const res = await agent.get("/food");
      const spinach = res.body.data.find((food: Food) => food.name === "Apple");
      await agent
        .patch(`/food/${spinach._id}`)
        .send({
          name: "Broccoli",
        })
        .expect(403);
    });

    it("delete", async () => {
      const res = await agent.get("/food");
      const res2 = await agent.delete(`/food/${res.body.data[0]._id}`);
      expect(res2.status).toBe(405);
    });
  });

  describe("admin food", () => {
    let agent: TestAgent;

    beforeEach(async () => {
      agent = await authAsUser(app, "admin");
    });

    it("list", async () => {
      const res = await agent.get("/food");
      expect(res.body.data).toHaveLength(2);
    });

    it("get", async () => {
      const res = await agent.get("/food");
      expect(res.body.data).toHaveLength(2);
      const res2 = await agent.get(`/food/${res.body.data[0]._id}`);
      expect(res.body.data[0]._id).toBe(res2.body.data._id);
    });

    it("post", async () => {
      const res = await agent.post("/food").send({
        calories: 15,
        name: "Broccoli",
      });
      expect(res.status).toBe(201);
    });

    it("patch", async () => {
      const res = await agent.get("/food");
      await agent
        .patch(`/food/${res.body.data[0]._id}`)
        .send({
          name: "Broccoli",
        })
        .expect(200);
    });

    it("delete", async () => {
      const res = await agent.get("/food");
      await agent.delete(`/food/${res.body.data[0]._id}`).expect(204);
    });

    it("handles validation errors", async () => {
      await agent
        .post("/required")
        .send({
          about: "Whoops forgot required",
        })
        .expect(400);
    });
  });
});

describe("permissions module", () => {
  describe("OwnerQueryFilter", () => {
    it("returns ownerId filter when user is provided", () => {
      const user = {id: "user-123"} as any;
      const filter = OwnerQueryFilter(user);
      expect(filter).toEqual({ownerId: "user-123"});
    });

    it("returns null when user is undefined", () => {
      const filter = OwnerQueryFilter(undefined);
      expect(filter).toBeNull();
    });
  });

  describe("Permissions.IsAuthenticatedOrReadOnly", () => {
    it("returns true for authenticated non-anonymous users", () => {
      const user = {id: "user-123", isAnonymous: false} as any;
      expect(Permissions.IsAuthenticatedOrReadOnly("create", user)).toBe(true);
    });

    it("returns true for read methods when user is anonymous", () => {
      const user = {id: "user-123", isAnonymous: true} as any;
      expect(Permissions.IsAuthenticatedOrReadOnly("list", user)).toBe(true);
      expect(Permissions.IsAuthenticatedOrReadOnly("read", user)).toBe(true);
    });

    it("returns false for write methods when user is anonymous", () => {
      const user = {id: "user-123", isAnonymous: true} as any;
      expect(Permissions.IsAuthenticatedOrReadOnly("create", user)).toBe(false);
      expect(Permissions.IsAuthenticatedOrReadOnly("update", user)).toBe(false);
      expect(Permissions.IsAuthenticatedOrReadOnly("delete", user)).toBe(false);
    });
  });

  describe("Permissions.IsOwnerOrReadOnly", () => {
    it("returns true when no object is provided", () => {
      expect(Permissions.IsOwnerOrReadOnly("update", {id: "user-123"} as any, undefined)).toBe(true);
    });

    it("returns true for admin users", () => {
      const user = {admin: true, id: "admin-123"} as any;
      const obj = {ownerId: "other-user"};
      expect(Permissions.IsOwnerOrReadOnly("update", user, obj)).toBe(true);
    });

    it("returns true when user is owner", () => {
      const user = {id: "user-123"} as any;
      const obj = {ownerId: "user-123"};
      expect(Permissions.IsOwnerOrReadOnly("update", user, obj)).toBe(true);
    });

    it("returns true for read methods when not owner", () => {
      const user = {id: "user-123"} as any;
      const obj = {ownerId: "other-user"};
      expect(Permissions.IsOwnerOrReadOnly("list", user, obj)).toBe(true);
      expect(Permissions.IsOwnerOrReadOnly("read", user, obj)).toBe(true);
    });

    it("returns false for write methods when not owner", () => {
      const user = {id: "user-123"} as any;
      const obj = {ownerId: "other-user"};
      expect(Permissions.IsOwnerOrReadOnly("update", user, obj)).toBe(false);
      expect(Permissions.IsOwnerOrReadOnly("delete", user, obj)).toBe(false);
    });
  });
});
