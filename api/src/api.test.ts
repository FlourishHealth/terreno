import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {addPopulateToQuery, modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {Permissions} from "./permissions";
import {
  authAsUser,
  type Food,
  FoodModel,
  getBaseServer,
  RequiredModel,
  setupDb,
  UserModel,
} from "./tests";
import {AdminOwnerTransformer} from "./transformers";

describe("@terreno/api", () => {
  let server: TestAgent;
  let app: express.Application;

  describe("populate", () => {
    let admin: any;
    let notAdmin: any;
    let agent: TestAgent;
    let spinach: Food;

    beforeEach(async () => {
      [admin, notAdmin] = await setupDb();

      [spinach] = await Promise.all([
        FoodModel.create({
          calories: 1,
          created: new Date("2021-12-03T00:00:20.000Z"),
          hidden: false,
          name: "Spinach",
          ownerId: admin._id,
          source: {
            name: "Brand",
          },
        }),
        FoodModel.create({
          calories: 1,
          created: new Date("2022-12-03T00:00:20.000Z"),
          hidden: false,
          name: "Carrots",
          ownerId: notAdmin._id,
          source: {
            name: "User",
          },
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
          populatePaths: [{fields: ["email"], path: "ownerId"}],
          sort: "-created",
        })
      );
      server = supertest(app);
      agent = await authAsUser(app, "notAdmin");
    });

    it("lists with populate", async () => {
      const res = await agent.get("/food").expect(200);
      expect(res.body.data).toHaveLength(2);
      const [carrots, spin] = res.body.data;
      expect(carrots.ownerId._id).toBe(notAdmin._id.toString());
      expect(carrots.ownerId.email).toBe(notAdmin.email);
      expect(carrots.ownerId.name).toBeUndefined();
      expect(spin.ownerId._id).toBe(admin._id.toString());
      expect(spin.ownerId.email).toBe(admin.email);
      expect(spin.ownerId.name).toBeUndefined();
    });

    it("reads with populate", async () => {
      const res = await agent.get(`/food/${spinach._id}`).expect(200);
      expect(res.body.data.ownerId._id).toBe(admin._id.toString());
      expect(res.body.data.ownerId.email).toBe(admin.email);
      expect(res.body.data.ownerId.name).toBeUndefined();
    });

    it("creates with populate", async () => {
      const res = await server
        .post("/food")
        .send({
          calories: 15,
          name: "Broccoli",
          ownerId: admin._id,
        })
        .expect(201);
      expect(res.body.data.ownerId._id).toBe(admin._id.toString());
      expect(res.body.data.ownerId.email).toBe(admin.email);
      expect(res.body.data.ownerId.name).toBeUndefined();
    });

    it("updates with populate", async () => {
      const res = await server
        .patch(`/food/${spinach._id}`)
        .send({
          name: "NotSpinach",
        })
        .expect(200);
      expect(res.body.data.ownerId._id).toBe(admin._id.toString());
      expect(res.body.data.ownerId.email).toBe(admin.email);
      expect(res.body.data.ownerId.name).toBeUndefined();
    });
  });

  describe("responseHandler", () => {
    let admin: any;
    let agent: TestAgent;
    let spinach: Food;

    beforeEach(async () => {
      [admin] = await setupDb();

      [spinach] = await Promise.all([
        FoodModel.create({
          calories: 1,
          created: new Date("2021-12-03T00:00:20.000Z"),
          hidden: false,
          name: "Spinach",
          ownerId: admin._id,
          source: {
            name: "Brand",
          },
        }),
        FoodModel.create({
          calories: 100,
          created: Date.now() - 10,
          hidden: true,
          name: "Apple",
          ownerId: admin?._id,
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
          responseHandler: (data, method) => {
            if (method === "list") {
              return (data as any).map((d: any) => ({
                foo: "bar",
                id: (d as any)._id,
              }));
            }
            return {
              foo: "bar",
              id: (data as any)._id,
            };
          },
        })
      );
      server = supertest(app);
      agent = await authAsUser(app, "notAdmin");
    });

    it("reads with serialize", async () => {
      const res = await agent.get(`/food/${spinach._id}`).expect(200);
      expect(res.body.data.ownerId).toBeUndefined();
      expect(res.body.data.id).toBe(spinach._id.toString());
      expect(res.body.data.foo).toBe("bar");
    });

    it("list with serialize", async () => {
      const res = await agent.get("/food").expect(200);
      expect(res.body.data[0].ownerId).toBeUndefined();
      expect(res.body.data[1].ownerId).toBeUndefined();

      expect(res.body.data[0].id).toBeDefined();
      expect(res.body.data[0].foo).toBe("bar");
      expect(res.body.data[1].id).toBeDefined();
      expect(res.body.data[1].foo).toBe("bar");
    });
  });

  describe("plugins", () => {
    let agent: TestAgent;

    beforeEach(async () => {
      await setupDb();
      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
      app.use(
        "/users",
        modelRouter(UserModel, {
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
      agent = await authAsUser(app, "notAdmin");
    });

    it("check that security fields are filtered", async () => {
      const res = await agent.get("/users").expect(200);
      expect(res.body.data[0].email).toBeDefined();
      expect(res.body.data[0].token).toBeUndefined();
      expect(res.body.data[0].hash).toBeUndefined();
      expect(res.body.data[0].salt).toBeUndefined();
    });
  });

  describe("error handling", () => {
    let admin: any;
    let spinach: Food;

    beforeEach(async () => {
      [admin] = await setupDb();

      spinach = await FoodModel.create({
        calories: 1,
        created: new Date("2021-12-03T00:00:20.000Z"),
        hidden: false,
        name: "Spinach",
        ownerId: admin._id,
        source: {
          name: "Brand",
        },
      });

      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
    });

    it("PUT returns 500 not supported", async () => {
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

      const res = await server.put(`/food/${spinach._id}`).send({name: "Kale"}).expect(500);
      expect(res.body.title).toBe("PUT is not supported.");
    });

    it("responseHandler error in read is handled", async () => {
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
          responseHandler: (_data, method) => {
            if (method === "read") {
              throw new Error("responseHandler read failed");
            }
            return {} as any;
          },
        })
      );
      server = supertest(app);

      const res = await server.get(`/food/${spinach._id}`).expect(500);
      expect(res.body.title).toContain("responseHandler error");
    });

    it("responseHandler error in create is handled", async () => {
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
          responseHandler: (_data, method) => {
            if (method === "create") {
              throw new Error("responseHandler create failed");
            }
            return {} as any;
          },
        })
      );
      server = supertest(app);

      const res = await server.post("/food").send({calories: 15, name: "Broccoli"}).expect(500);
      expect(res.body.title).toContain("responseHandler error");
    });

    it("responseHandler error in update is handled", async () => {
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
          responseHandler: (_data, method) => {
            if (method === "update") {
              throw new Error("responseHandler update failed");
            }
            return {} as any;
          },
        })
      );
      server = supertest(app);

      const res = await server.patch(`/food/${spinach._id}`).send({name: "Kale"}).expect(500);
      expect(res.body.title).toContain("responseHandler error");
    });

    it("responseHandler error in list is handled", async () => {
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
          responseHandler: (_data, method) => {
            if (method === "list") {
              throw new Error("responseHandler list failed");
            }
            return {} as any;
          },
        })
      );
      server = supertest(app);

      const res = await server.get("/food").expect(500);
      expect(res.body.title).toContain("responseHandler error");
    });

    it("list with non-array responseHandler returns data directly", async () => {
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
          responseHandler: (_data, method) => {
            if (method === "list") {
              return {custom: "response"} as any;
            }
            return {} as any;
          },
        })
      );
      server = supertest(app);

      const res = await server.get("/food").expect(200);
      expect(res.body.data).toEqual({custom: "response"});
      expect(res.body.more).toBeUndefined();
      expect(res.body.total).toBeUndefined();
    });

    it("list with query sort param", async () => {
      await FoodModel.create({
        calories: 200,
        created: new Date("2021-12-04T00:00:20.000Z"),
        hidden: false,
        name: "Apple",
        ownerId: admin._id,
      });

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
          queryFields: ["name"],
        })
      );
      server = supertest(app);

      let res = await server.get("/food?sort=name").expect(200);
      expect(res.body.data[0].name).toBe("Apple");
      expect(res.body.data[1].name).toBe("Spinach");

      res = await server.get("/food?sort=-name").expect(200);
      expect(res.body.data[0].name).toBe("Spinach");
      expect(res.body.data[1].name).toBe("Apple");
    });

    it("queryFilter error is handled", async () => {
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
          queryFilter: () => {
            throw new Error("queryFilter failed");
          },
        })
      );
      server = supertest(app);

      const res = await server.get("/food").expect(400);
      expect(res.body.title).toContain("Query filter error");
    });

    it("custom endpoints take priority", async () => {
      app.use(
        "/food",
        modelRouter(FoodModel, {
          allowAnonymous: true,
          endpoints: (router: any) => {
            router.get("/custom", (_req: any, res: any) => {
              res.json({custom: true});
            });
          },
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

      const res = await server.get("/food/custom").expect(200);
      expect(res.body.custom).toBe(true);
    });

    it("disallowed query param returns 400", async () => {
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
          queryFields: ["name"],
        })
      );
      server = supertest(app);

      const res = await server.get("/food?calories=100").expect(400);
      expect(res.body.title).toContain("calories is not allowed as a query param");
    });

    it("queryFilter returning null returns empty array", async () => {
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
          queryFilter: () => null,
        })
      );
      server = supertest(app);

      const res = await server.get("/food").expect(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("transformer errors", () => {
    let admin: any;
    let spinach: Food;

    beforeEach(async () => {
      [admin] = await setupDb();

      spinach = await FoodModel.create({
        calories: 1,
        created: new Date("2021-12-03T00:00:20.000Z"),
        hidden: false,
        name: "Spinach",
        ownerId: admin._id,
        source: {
          name: "Brand",
        },
      });

      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
    });

    it("transform error in create is handled", async () => {
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
          transformer: AdminOwnerTransformer({
            anonWriteFields: ["name"],
          }),
        })
      );
      server = supertest(app);

      const res = await server.post("/food").send({calories: 15, name: "Broccoli"}).expect(400);
      expect(res.body.title).toContain("cannot write fields");
    });

    it("transform error in patch is handled", async () => {
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
          transformer: AdminOwnerTransformer({
            anonWriteFields: ["name"],
          }),
        })
      );
      server = supertest(app);

      const res = await server.patch(`/food/${spinach._id}`).send({calories: 100}).expect(403);
      expect(res.body.title).toContain("cannot write fields");
    });

    it("model.create validation error is handled", async () => {
      app.use(
        "/required",
        modelRouter(RequiredModel, {
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

      const res = await server.post("/required").send({about: "test"}).expect(400);
      expect(res.body.title).toContain("Required");
    });
  });

  describe("addPopulateToQuery", () => {
    it("returns query unchanged with no populate paths", async () => {
      await setupDb();
      const query = FoodModel.find({});
      const result = addPopulateToQuery(query, undefined);
      expect(result).toBe(query);
    });

    it("returns query unchanged with empty populate paths", async () => {
      await setupDb();
      const query = FoodModel.find({});
      const result = addPopulateToQuery(query, []);
      expect(result).toBe(query);
    });

    it("applies multiple populate paths", async () => {
      await setupDb();
      const query = FoodModel.find({});
      const result = addPopulateToQuery(query, [
        {fields: ["email"], path: "ownerId"},
        {fields: ["name"], path: "eatenBy"},
      ]);
      expect(result).toBeDefined();
    });
  });

  describe("soft delete with isDeleted plugin", () => {
    let admin: any;
    let agent: TestAgent;

    beforeEach(async () => {
      [admin] = await setupDb();

      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
    });

    it("soft deletes user with deleted field", async () => {
      app.use(
        "/users",
        modelRouter(UserModel, {
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
      agent = await authAsUser(app, "notAdmin");

      const res = await agent.delete(`/users/${admin._id}`).expect(204);
      expect(res.body).toEqual({});

      const deletedUser = await UserModel.findById(admin._id);
      expect(deletedUser).toBeNull();
    });
  });

  describe("populate in create", () => {
    let admin: any;

    beforeEach(async () => {
      [admin] = await setupDb();

      await FoodModel.create({
        calories: 1,
        created: new Date("2021-12-03T00:00:20.000Z"),
        hidden: false,
        name: "Spinach",
        ownerId: admin._id,
      });

      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
    });

    it("handles populate with valid path in create", async () => {
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
          populatePaths: [{fields: ["email"], path: "ownerId"}],
        })
      );
      server = supertest(app);

      const res = await server
        .post("/food")
        .send({calories: 15, name: "Broccoli", ownerId: admin._id})
        .expect(201);
      expect(res.body.data.name).toBe("Broccoli");
      expect(res.body.data.ownerId.email).toBe(admin.email);
    });
  });

  describe("save error handling", () => {
    let admin: any;
    let spinach: Food;

    beforeEach(async () => {
      [admin] = await setupDb();

      spinach = await FoodModel.create({
        calories: 1,
        created: new Date("2021-12-03T00:00:20.000Z"),
        hidden: false,
        name: "Spinach",
        ownerId: admin._id,
        source: {
          name: "Brand",
        },
      });

      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
    });

    it("handles patch save error with validation failure", async () => {
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

      const res = await server
        .patch(`/food/${spinach._id}`)
        .send({invalidField: "value"})
        .expect(400);
      expect(res.body.title).toContain("preUpdate hook save error");
    });
  });

  describe("body undefined after transform without preCreate", () => {
    beforeEach(async () => {
      await setupDb();

      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
    });

    it("handles undefined body after transform when no preCreate", async () => {
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
            transform: () => undefined,
          },
        })
      );
      server = supertest(app);

      const res = await server.post("/food").send({calories: 15, name: "Broccoli"}).expect(400);
      expect(res.body.title).toBe("Invalid request body");
      expect(res.body.detail).toBe("Body is undefined");
    });
  });

  describe("soft delete with deleted field", () => {
    let _admin: any;
    let agent: TestAgent;

    beforeEach(async () => {
      [_admin] = await setupDb();

      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
    });

    it("soft deletes document with deleted field using isDeletedPlugin", async () => {
      const mongoose = await import("mongoose");

      const softDeleteSchema = new mongoose.Schema({
        deleted: {default: false, type: Boolean},
        name: String,
      });

      let SoftDeleteModel;
      try {
        SoftDeleteModel = mongoose.model("SoftDeleteTest");
      } catch {
        SoftDeleteModel = mongoose.model("SoftDeleteTest", softDeleteSchema);
      }

      await SoftDeleteModel.deleteMany({});

      const testDoc = await SoftDeleteModel.create({name: "TestItem"});

      app.use(
        "/softdelete",
        modelRouter(SoftDeleteModel, {
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
      agent = await authAsUser(app, "notAdmin");

      await agent.delete(`/softdelete/${testDoc._id}`).expect(204);

      const softDeleted = await SoftDeleteModel.findById(testDoc._id);
      expect(softDeleted).not.toBeNull();
      expect(softDeleted?.deleted).toBe(true);

      await SoftDeleteModel.deleteMany({});
    });
  });
});
