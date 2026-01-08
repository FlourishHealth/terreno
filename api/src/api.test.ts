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

describe("errors module", () => {
  describe("APIError", () => {
    it("sets default status to 500 when not provided", () => {
      const error = new APIError({title: "Test error"});
      expect(error.status).toBe(500);
    });

    it("sets status to 500 for invalid status codes below 400", () => {
      const error = new APIError({status: 200, title: "Test error"});
      expect(error.status).toBe(500);
    });

    it("sets status to 500 for invalid status codes above 599", () => {
      const error = new APIError({status: 600, title: "Test error"});
      expect(error.status).toBe(500);
    });

    it("includes error stack in message when error is provided", () => {
      const originalError = new Error("Original error");
      const apiError = new APIError({
        error: originalError,
        title: "Wrapped error",
      });
      expect(apiError.message).toContain("Wrapped error");
      expect(originalError.stack).toBeDefined();
      expect(apiError.message).toContain(originalError.stack as string);
    });

    it("includes detail in message when provided", () => {
      const error = new APIError({
        detail: "More details here",
        title: "Test error",
      });
      expect(error.message).toContain("Test error");
      expect(error.message).toContain("More details here");
    });

    it("sets fields in meta when provided", () => {
      const error = new APIError({
        fields: {email: "Invalid email format"},
        title: "Validation error",
      });
      expect(error.meta?.fields).toEqual({email: "Invalid email format"});
    });
  });

  describe("errorsPlugin", () => {
    it("adds apiErrors field to schema", async () => {
      const mongoose = await import("mongoose");
      const {errorsPlugin} = await import("./errors");

      const testSchema = new mongoose.Schema({name: String});
      errorsPlugin(testSchema);

      expect(testSchema.path("apiErrors")).toBeDefined();
    });
  });

  describe("isAPIError", () => {
    it("returns true for APIError instances", () => {
      const {isAPIError} = require("./errors");
      const error = new APIError({title: "Test"});
      expect(isAPIError(error)).toBe(true);
    });

    it("returns false for regular Error instances", () => {
      const {isAPIError} = require("./errors");
      const error = new Error("Test");
      expect(isAPIError(error)).toBe(false);
    });
  });

  describe("getDisableExternalErrorTracking", () => {
    it("returns undefined for non-objects", () => {
      const {getDisableExternalErrorTracking} = require("./errors");
      expect(getDisableExternalErrorTracking(null)).toBeUndefined();
      expect(getDisableExternalErrorTracking("string")).toBeUndefined();
    });

    it("returns value from APIError", () => {
      const {getDisableExternalErrorTracking} = require("./errors");
      const error = new APIError({disableExternalErrorTracking: true, title: "Test"});
      expect(getDisableExternalErrorTracking(error)).toBe(true);
    });

    it("returns value from plain object with property", () => {
      const {getDisableExternalErrorTracking} = require("./errors");
      const obj = {disableExternalErrorTracking: true};
      expect(getDisableExternalErrorTracking(obj)).toBe(true);
    });
  });

  describe("getAPIErrorBody", () => {
    it("includes all non-undefined fields", () => {
      const {getAPIErrorBody} = require("./errors");
      const error = new APIError({
        code: "TEST_CODE",
        detail: "Test detail",
        id: "error-123",
        links: {about: "http://example.com"},
        meta: {extra: "data"},
        source: {parameter: "id"},
        status: 400,
        title: "Test error",
      });
      const body = getAPIErrorBody(error);

      expect(body.title).toBe("Test error");
      expect(body.status).toBe(400);
      expect(body.code).toBe("TEST_CODE");
      expect(body.detail).toBe("Test detail");
      expect(body.id).toBe("error-123");
      expect(body.links).toEqual({about: "http://example.com"});
      expect(body.source).toEqual({parameter: "id"});
      expect(body.meta).toEqual({extra: "data"});
    });
  });

  describe("apiUnauthorizedMiddleware", () => {
    it("returns 401 for Unauthorized errors", () => {
      const {apiUnauthorizedMiddleware} = require("./errors");
      const err = new Error("Unauthorized");
      const res = {
        json: function (data: any) {
          (this as any).body = data;
          return this;
        },
        send: function () {
          return this;
        },
        status: function (code: number) {
          (this as any).statusCode = code;
          return this;
        },
      };
      const next = () => {};

      apiUnauthorizedMiddleware(err, {}, res, next);
      expect((res as any).statusCode).toBe(401);
      expect((res as any).body.title).toBe("Unauthorized");
    });

    it("calls next for non-Unauthorized errors", () => {
      const {apiUnauthorizedMiddleware} = require("./errors");
      const err = new Error("Some other error");
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      apiUnauthorizedMiddleware(err, {}, {}, next);
      expect(nextCalled).toBe(true);
    });
  });
});

describe("permissions module", () => {
  describe("OwnerQueryFilter", () => {
    it("returns ownerId filter when user is provided", () => {
      const {OwnerQueryFilter} = require("./permissions");
      const user = {id: "user-123"};
      const filter = OwnerQueryFilter(user);
      expect(filter).toEqual({ownerId: "user-123"});
    });

    it("returns null when user is undefined", () => {
      const {OwnerQueryFilter} = require("./permissions");
      const filter = OwnerQueryFilter(undefined);
      expect(filter).toBeNull();
    });
  });

  describe("Permissions.IsAuthenticatedOrReadOnly", () => {
    it("returns true for authenticated non-anonymous users", () => {
      const {Permissions} = require("./permissions");
      const user = {id: "user-123", isAnonymous: false};
      expect(Permissions.IsAuthenticatedOrReadOnly("create", user)).toBe(true);
    });

    it("returns true for read methods when user is anonymous", () => {
      const {Permissions} = require("./permissions");
      const user = {id: "user-123", isAnonymous: true};
      expect(Permissions.IsAuthenticatedOrReadOnly("list", user)).toBe(true);
      expect(Permissions.IsAuthenticatedOrReadOnly("read", user)).toBe(true);
    });

    it("returns false for write methods when user is anonymous", () => {
      const {Permissions} = require("./permissions");
      const user = {id: "user-123", isAnonymous: true};
      expect(Permissions.IsAuthenticatedOrReadOnly("create", user)).toBe(false);
      expect(Permissions.IsAuthenticatedOrReadOnly("update", user)).toBe(false);
      expect(Permissions.IsAuthenticatedOrReadOnly("delete", user)).toBe(false);
    });
  });

  describe("Permissions.IsOwnerOrReadOnly", () => {
    it("returns true when no object is provided", () => {
      const {Permissions} = require("./permissions");
      expect(Permissions.IsOwnerOrReadOnly("update", {id: "user-123"}, undefined)).toBe(true);
    });

    it("returns true for admin users", () => {
      const {Permissions} = require("./permissions");
      const user = {admin: true, id: "admin-123"};
      const obj = {ownerId: "other-user"};
      expect(Permissions.IsOwnerOrReadOnly("update", user, obj)).toBe(true);
    });

    it("returns true when user is owner", () => {
      const {Permissions} = require("./permissions");
      const user = {id: "user-123"};
      const obj = {ownerId: "user-123"};
      expect(Permissions.IsOwnerOrReadOnly("update", user, obj)).toBe(true);
    });

    it("returns true for read methods when not owner", () => {
      const {Permissions} = require("./permissions");
      const user = {id: "user-123"};
      const obj = {ownerId: "other-user"};
      expect(Permissions.IsOwnerOrReadOnly("list", user, obj)).toBe(true);
      expect(Permissions.IsOwnerOrReadOnly("read", user, obj)).toBe(true);
    });

    it("returns false for write methods when not owner", () => {
      const {Permissions} = require("./permissions");
      const user = {id: "user-123"};
      const obj = {ownerId: "other-user"};
      expect(Permissions.IsOwnerOrReadOnly("update", user, obj)).toBe(false);
      expect(Permissions.IsOwnerOrReadOnly("delete", user, obj)).toBe(false);
    });
  });
});

describe("utils module", () => {
  describe("isValidObjectId", () => {
    it("returns true for valid ObjectId strings", () => {
      const {isValidObjectId} = require("./utils");
      expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
    });

    it("returns false for invalid ObjectId strings", () => {
      const {isValidObjectId} = require("./utils");
      expect(isValidObjectId("invalid-id")).toBe(false);
      expect(isValidObjectId("12345")).toBe(false);
      expect(isValidObjectId("")).toBe(false);
    });

    it("returns false for 12-character strings that are not valid ObjectIds", () => {
      const {isValidObjectId} = require("./utils");
      // mongoose's native isValid returns true for any 12-char string
      // but our implementation should return false since toString won't match
      expect(isValidObjectId("123456789012")).toBe(false);
    });
  });

  describe("timeout", () => {
    it("resolves after specified time", async () => {
      const {timeout} = require("./utils");
      const start = Date.now();
      await timeout(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  // Note: Comprehensive checkModelsStrict tests are in utils.test.ts with mocked mongoose
});

describe("populate module", () => {
  describe("unpopulate", () => {
    it("throws error when path is empty", async () => {
      const {unpopulate} = await import("./populate");
      const doc = {name: "test"};
      expect(() => unpopulate(doc as any, "")).toThrow("path is required");
    });

    it("unpopulates single populated field", async () => {
      const {unpopulate} = await import("./populate");
      const doc = {
        name: "test",
        ownerId: {_id: "owner-123", email: "owner@test.com"},
      };
      const result = unpopulate(doc as any, "ownerId") as any;
      expect(result.ownerId).toBe("owner-123");
    });

    it("unpopulates array of populated fields", async () => {
      const {unpopulate} = await import("./populate");
      const doc = {
        items: [{_id: "item-1", name: "Item 1"}, {_id: "item-2", name: "Item 2"}, "item-3"],
        name: "test",
      };
      const result = unpopulate(doc as any, "items") as any;
      expect(result.items).toEqual(["item-1", "item-2", "item-3"]);
    });

    it("handles nested paths", async () => {
      const {unpopulate} = await import("./populate");
      const doc = {
        name: "test",
        nested: {
          items: [
            {_id: "item-1", name: "Item 1"},
            {_id: "item-2", name: "Item 2"},
          ],
        },
      };
      const result = unpopulate(doc as any, "nested.items") as any;
      expect(result.nested.items).toEqual(["item-1", "item-2"]);
    });

    it("returns original doc when path does not exist", async () => {
      const {unpopulate} = await import("./populate");
      const doc = {name: "test"};
      const result = unpopulate(doc as any, "nonexistent") as any;
      expect(result).toEqual(doc);
    });

    it("handles nested array paths", async () => {
      const {unpopulate} = await import("./populate");
      const doc = {
        containers: [
          {items: [{_id: "item-1"}, {_id: "item-2"}]},
          {items: [{_id: "item-3"}, {_id: "item-4"}]},
        ],
        name: "test",
      };
      const result = unpopulate(doc as any, "containers.items") as any;
      expect(result.containers[0].items).toEqual(["item-1", "item-2"]);
      expect(result.containers[1].items).toEqual(["item-3", "item-4"]);
    });
  });
});

describe("auth module edge cases", () => {
  describe("generateTokens", () => {
    it("returns null tokens when user is missing", async () => {
      const {generateTokens} = await import("./auth");
      const result = await generateTokens(null);
      expect(result.token).toBeNull();
      expect(result.refreshToken).toBeNull();
    });

    it("returns null tokens when user has no _id", async () => {
      const {generateTokens} = await import("./auth");
      const result = await generateTokens({email: "test@test.com"});
      expect(result.token).toBeNull();
      expect(result.refreshToken).toBeNull();
    });

    it("includes custom payload from generateJWTPayload option", async () => {
      const {generateTokens} = await import("./auth");
      const jwt = await import("jsonwebtoken");

      const user = {_id: "user-123"};
      const result = await generateTokens(user, {
        generateJWTPayload: (u) => ({customField: "customValue", userId: u._id}),
      });

      expect(result.token).toBeDefined();
      const decoded = jwt.decode(result.token as string) as any;
      expect(decoded.customField).toBe("customValue");
      expect(decoded.id).toBe("user-123");
    });

    it("uses custom token expiration from generateTokenExpiration option", async () => {
      const {generateTokens} = await import("./auth");
      const jwt = await import("jsonwebtoken");

      const user = {_id: "user-123"};
      const result = await generateTokens(user, {
        generateTokenExpiration: () => "1h",
      });

      expect(result.token).toBeDefined();
      const decoded = jwt.decode(result.token as string) as any;
      // Check that exp is roughly 1 hour from now (within 5 seconds tolerance)
      const expectedExp = Math.floor(Date.now() / 1000) + 3600;
      expect(decoded.exp).toBeGreaterThan(expectedExp - 5);
      expect(decoded.exp).toBeLessThan(expectedExp + 5);
    });

    it("uses custom refresh token expiration from generateRefreshTokenExpiration option", async () => {
      const {generateTokens} = await import("./auth");
      const jwt = await import("jsonwebtoken");

      const user = {_id: "user-123"};
      const result = await generateTokens(user, {
        generateRefreshTokenExpiration: () => "7d",
      });

      expect(result.refreshToken).toBeDefined();
      const decoded = jwt.decode(result.refreshToken as string) as any;
      // Check that exp is roughly 7 days from now
      const expectedExp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
      expect(decoded.exp).toBeGreaterThan(expectedExp - 10);
      expect(decoded.exp).toBeLessThan(expectedExp + 10);
    });
  });
});
