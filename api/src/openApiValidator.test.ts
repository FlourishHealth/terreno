import {afterEach, beforeEach, describe, expect, it} from "bun:test";

import {modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {
  buildQuerySchemaFromFields,
  configureOpenApiValidator,
  isOpenApiValidatorConfigured,
  resetOpenApiValidatorConfig,
  validateRequestBody,
} from "./openApiValidator";
import {Permissions} from "./permissions";
import {authAsUser, FoodModel, getBaseServer, RequiredModel, setupDb, UserModel} from "./tests";

// RequiredModel has a clean schema that AJV can compile (no non-standard types).
// It has: name (String, required), about (String, optional)
const requiredRouterOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsAdmin],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsAuthenticated],
  },
  queryFields: ["name"],
  sort: "-name" as const,
};

const setupFreshApp = async () => {
  const freshApp = getBaseServer();
  setupAuth(freshApp, UserModel as any);
  addAuthRoutes(freshApp, UserModel as any);
  return freshApp;
};

describe("openApiValidator", () => {
  beforeEach(async () => {
    resetOpenApiValidatorConfig();
    await setupDb();
    await RequiredModel.deleteMany({});
  });

  afterEach(() => {
    resetOpenApiValidatorConfig();
  });

  describe("isConfigured flag", () => {
    it("is false by default", () => {
      expect(isOpenApiValidatorConfigured()).toBe(false);
    });

    it("becomes true after configureOpenApiValidator()", () => {
      configureOpenApiValidator();
      expect(isOpenApiValidatorConfigured()).toBe(true);
    });

    it("resets to false after resetOpenApiValidatorConfig()", () => {
      configureOpenApiValidator();
      expect(isOpenApiValidatorConfigured()).toBe(true);
      resetOpenApiValidatorConfig();
      expect(isOpenApiValidatorConfigured()).toBe(false);
    });
  });

  describe("no-op when not configured", () => {
    it("does not strip or validate when not configured", async () => {
      const freshApp = await setupFreshApp();
      freshApp.use("/required", modelRouter(RequiredModel, requiredRouterOptions));
      const admin = await authAsUser(freshApp, "admin");

      // When not configured, validation is a no-op — valid requests pass through
      const res = await admin.post("/required").send({name: "Apple"}).expect(201);
      expect(res.body.data.name).toBe("Apple");
    });
  });

  describe("active after configuration", () => {
    it("strips extra properties when removeAdditional is true", async () => {
      configureOpenApiValidator({removeAdditional: true});

      const freshApp = await setupFreshApp();
      freshApp.use("/required", modelRouter(RequiredModel, requiredRouterOptions));
      const admin = await authAsUser(freshApp, "admin");

      const res = await admin
        .post("/required")
        .send({fakeField: "this should be stripped", name: "Apple"})
        .expect(201);

      expect(res.body.data.name).toBe("Apple");
      expect(res.body.data.fakeField).toBeUndefined();
    });

    it("rejects missing required fields", async () => {
      configureOpenApiValidator();

      const freshApp = await setupFreshApp();
      freshApp.use("/required", modelRouter(RequiredModel, requiredRouterOptions));
      const admin = await authAsUser(freshApp, "admin");

      const res = await admin.post("/required").send({about: "no name"}).expect(400);
      expect(res.body.title).toBe("Request validation failed");
    });
  });

  describe("onAdditionalPropertiesRemoved hook", () => {
    it("fires callback with removed property names", async () => {
      const removedProps: string[] = [];

      configureOpenApiValidator({
        onAdditionalPropertiesRemoved: (props) => {
          removedProps.push(...props);
        },
        removeAdditional: true,
      });

      const freshApp = await setupFreshApp();
      freshApp.use("/required", modelRouter(RequiredModel, requiredRouterOptions));
      const admin = await authAsUser(freshApp, "admin");

      await admin
        .post("/required")
        .send({extraA: "stripped", extraB: "also stripped", name: "Apple"})
        .expect(201);

      expect(removedProps).toContain("extraA");
      expect(removedProps).toContain("extraB");
    });
  });

  describe("per-route validation: false override", () => {
    it("skips validation when validation is false", async () => {
      configureOpenApiValidator({removeAdditional: true});

      const freshApp = await setupFreshApp();
      freshApp.use(
        "/required",
        modelRouter(RequiredModel, {
          ...requiredRouterOptions,
          validation: false,
        })
      );
      const admin = await authAsUser(freshApp, "admin");

      // With validation: false, extra properties are NOT stripped by validator
      // RequiredModel does not have strict: "throw" so the extra field will just be ignored by Mongoose
      const res = await admin
        .post("/required")
        .send({fakeField: "not stripped", name: "Apple"})
        .expect(201);

      expect(res.body.data.name).toBe("Apple");
    });
  });

  describe("graceful handling of non-standard schemas", () => {
    it("skips validation when model schema has non-standard types", async () => {
      configureOpenApiValidator({removeAdditional: true});

      const freshApp = await setupFreshApp();
      freshApp.use(
        "/food",
        modelRouter(FoodModel, {
          permissions: {
            create: [Permissions.IsAuthenticated],
            delete: [Permissions.IsAdmin],
            list: [Permissions.IsAuthenticated],
            read: [Permissions.IsAuthenticated],
            update: [Permissions.IsAuthenticated],
          },
          queryFields: ["name", "calories", "hidden"],
          sort: "-created",
        })
      );
      const admin = await authAsUser(freshApp, "admin");

      // FoodModel has non-standard types (schemaobjectid, dateonly) that AJV can't compile.
      // Validation should gracefully skip and let the request through to Mongoose.
      const res = await admin
        .post("/food")
        .send({calories: 100, likesIds: [], name: "Apple", source: {name: "Test"}})
        .expect(201);

      expect(res.body.data.name).toBe("Apple");
    });
  });

  describe("buildQuerySchemaFromFields", () => {
    it("always includes limit, page, and sort", () => {
      const schema = buildQuerySchemaFromFields(FoodModel, []);
      expect(schema.limit).toBeDefined();
      expect(schema.page).toBeDefined();
      expect(schema.sort).toBeDefined();
    });

    it("includes queryFields from model schema", () => {
      const schema = buildQuerySchemaFromFields(FoodModel, ["name", "calories"]);
      expect(schema.name).toBeDefined();
      expect(schema.calories).toBeDefined();
      expect(schema.hidden).toBeUndefined();
    });

    it("marks query fields as not required", () => {
      const schema = buildQuerySchemaFromFields(FoodModel, ["name"]);
      expect(schema.name.required).toBe(false);
    });
  });

  describe("validateRequestBody middleware", () => {
    it("is a no-op when not configured", () => {
      resetOpenApiValidatorConfig();

      const middleware = validateRequestBody({
        name: {required: true, type: "string"},
      });

      let nextCalled = false;
      const req = {body: {}} as any;
      const res = {} as any;
      const next = () => {
        nextCalled = true;
      };

      middleware(req, res, next);
      expect(nextCalled).toBe(true);
    });

    it("validates when configured", () => {
      configureOpenApiValidator();

      const middleware = validateRequestBody({
        name: {required: true, type: "string"},
      });

      const req = {body: {}, method: "POST", path: "/test"} as any;
      const res = {} as any;

      expect(() => {
        middleware(req, res, () => {});
      }).toThrow();
    });
  });
});
