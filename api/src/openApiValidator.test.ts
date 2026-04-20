import {afterEach, beforeEach, describe, expect, it} from "bun:test";

import {modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {
  buildQuerySchemaFromFields,
  configureOpenApiValidator,
  createModelValidators,
  createValidator,
  getOpenApiValidatorConfig,
  getSchemaFromModel,
  isOpenApiValidatorConfigured,
  resetOpenApiValidatorConfig,
  validateModelRequestBody,
  validateQueryParams,
  validateRequestBody,
  validateResponseData,
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

  describe("sanitization of non-standard mongoose-to-swagger types", () => {
    it("validates models with ObjectId and DateOnly fields after sanitization", async () => {
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

    it("calls onError callback instead of throwing when provided at option level", () => {
      configureOpenApiValidator();

      let capturedErrors: any[] = [];
      const middleware = validateRequestBody(
        {name: {required: true, type: "string"}},
        {
          onError: (errors) => {
            capturedErrors = errors;
          },
        }
      );

      let nextCalled = false;
      const req = {body: {}, method: "POST", path: "/test"} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(capturedErrors.length).toBeGreaterThan(0);
    });

    it("calls global onValidationError when no per-route handler", () => {
      let capturedErrors: any[] = [];
      configureOpenApiValidator({
        onValidationError: (errors) => {
          capturedErrors = errors;
        },
      });

      const middleware = validateRequestBody({name: {required: true, type: "string"}});

      let nextCalled = false;
      const req = {body: {}, method: "POST", path: "/test"} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(capturedErrors.length).toBeGreaterThan(0);
    });

    it("skips validation when enabled=false on options", () => {
      configureOpenApiValidator();

      const middleware = validateRequestBody(
        {name: {required: true, type: "string"}},
        {enabled: false}
      );

      let nextCalled = false;
      const req = {body: {}, method: "POST", path: "/test"} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("respects validateRequests=false in global config", () => {
      configureOpenApiValidator({validateRequests: false});

      const middleware = validateRequestBody({name: {required: true, type: "string"}});

      let nextCalled = false;
      const req = {body: {}, method: "POST", path: "/test"} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });
  });

  describe("validateQueryParams middleware", () => {
    it("is a no-op when not configured", () => {
      resetOpenApiValidatorConfig();

      const middleware = validateQueryParams({
        page: {type: "number"},
      });

      let nextCalled = false;
      const req = {method: "GET", path: "/test", query: {}} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("coerces types when configured", () => {
      configureOpenApiValidator({coerceTypes: true});

      const middleware = validateQueryParams({
        page: {type: "number"},
      });

      const req = {method: "GET", path: "/test", query: {page: "3"}} as any;
      const res = {} as any;
      middleware(req, res, () => {});

      expect(req.query.page).toBe(3);
    });

    it("throws validation error when query does not match", () => {
      configureOpenApiValidator({coerceTypes: false});

      const middleware = validateQueryParams({
        page: {required: true, type: "number"},
      });

      const req = {method: "GET", path: "/test", query: {}} as any;
      const res = {} as any;
      // Required top-level property missing triggers an error
      // We need required: [] at schema level via required: true on property. Confirm via calling.
      expect(() => {
        middleware(req, res, () => {});
      }).toThrow();
    });

    it("uses onError callback for query validation", () => {
      let captured: any[] = [];
      configureOpenApiValidator({coerceTypes: false});

      const middleware = validateQueryParams(
        {page: {required: true, type: "number"}},
        {
          onError: (errors) => {
            captured = errors;
          },
        }
      );

      let nextCalled = false;
      const req = {method: "GET", path: "/test", query: {}} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(captured.length).toBeGreaterThan(0);
    });

    it("skips query validation when enabled=false", () => {
      configureOpenApiValidator();

      const middleware = validateQueryParams(
        {page: {required: true, type: "number"}},
        {enabled: false}
      );

      let nextCalled = false;
      const req = {method: "GET", path: "/test", query: {}} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });
  });

  describe("validateResponseData", () => {
    it("returns valid when validateResponses is disabled", () => {
      configureOpenApiValidator({validateResponses: false});
      const result = validateResponseData({foo: "bar"}, {name: {type: "string"}});
      expect(result.valid).toBe(true);
    });

    it("validates response shape when validateResponses is enabled", () => {
      configureOpenApiValidator({validateResponses: true});
      const result = validateResponseData(
        {name: "Apple"},
        {name: {required: true, type: "string"}}
      );
      expect(result.valid).toBe(true);
    });

    it("returns errors for invalid response shape", () => {
      configureOpenApiValidator({coerceTypes: false, validateResponses: true});
      const result = validateResponseData(
        {name: 42 as any},
        {name: {required: true, type: "string"}}
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe("createValidator", () => {
    it("runs body then query validation and calls next once both pass", () => {
      configureOpenApiValidator({coerceTypes: true});

      const middleware = createValidator({
        body: {name: {required: true, type: "string"}},
        query: {page: {type: "number"}},
      });

      let nextCalled = false;
      const req = {
        body: {name: "ok"},
        method: "POST",
        path: "/test",
        query: {page: "2"},
      } as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.query.page).toBe(2);
    });

    it("skips when neither body nor query schemas are provided", () => {
      configureOpenApiValidator();

      const middleware = createValidator({});

      let nextCalled = false;
      const req = {body: {}, method: "POST", path: "/test", query: {}} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("runs only query validation when only query provided", () => {
      configureOpenApiValidator({coerceTypes: true});

      const middleware = createValidator({
        query: {page: {type: "number"}},
      });

      let nextCalled = false;
      const req = {method: "GET", path: "/test", query: {page: "5"}} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.query.page).toBe(5);
    });

    it("propagates body validation error via next", () => {
      let capturedErrors: any[] = [];
      configureOpenApiValidator({
        onValidationError: (errors) => {
          capturedErrors = errors;
        },
      });

      const middleware = createValidator({
        body: {name: {required: true, type: "string"}},
        query: {page: {type: "number"}},
      });

      const req = {body: {}, method: "POST", path: "/test", query: {}} as any;
      const res = {} as any;

      let nextCalled = false;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(capturedErrors.length).toBeGreaterThan(0);
      expect(nextCalled).toBe(true);
    });
  });

  describe("createModelValidators", () => {
    beforeEach(() => {
      configureOpenApiValidator();
    });

    it("returns create and update middleware", () => {
      const validators = createModelValidators(RequiredModel);
      expect(typeof validators.create).toBe("function");
      expect(typeof validators.update).toBe("function");
    });

    it("create validator rejects body with wrong type", () => {
      configureOpenApiValidator({coerceTypes: false});
      const {create} = createModelValidators(RequiredModel);

      const req = {body: {name: 123}, method: "POST", path: "/required"} as any;
      const res = {} as any;
      expect(() => {
        create(req, res, () => {});
      }).toThrow();
    });

    it("update validator allows a partial body", () => {
      const {update} = createModelValidators(RequiredModel);

      let nextCalled = false;
      const req = {body: {about: "info"}, method: "PATCH", path: "/required"} as any;
      const res = {} as any;
      update(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });

    it("supports onAdditionalPropertiesRemoved option", () => {
      configureOpenApiValidator({removeAdditional: true});
      const removedProps: string[] = [];
      const {create} = createModelValidators(RequiredModel, {
        onAdditionalPropertiesRemoved: (props) => {
          removedProps.push(...props);
        },
      });

      // Extra property gets stripped and hook is called
      const req = {
        body: {extra: "strip me", name: "Apple"},
        method: "POST",
        path: "/required",
      } as any;
      create(req, {} as any, () => {});
      expect(removedProps).toContain("extra");
    });

    it("supports onError option", () => {
      configureOpenApiValidator({coerceTypes: false});
      let errorHandled: any[] = [];
      const {create} = createModelValidators(RequiredModel, {
        onError: (errors) => {
          errorHandled = errors;
        },
      });

      // Wrong type triggers error handler
      const req = {body: {name: 42}, method: "POST", path: "/required"} as any;
      create(req, {} as any, () => {});
      expect(errorHandled.length).toBeGreaterThan(0);
    });
  });

  describe("validateModelRequestBody", () => {
    beforeEach(() => {
      configureOpenApiValidator();
    });

    it("creates a validator from a Mongoose model", () => {
      const middleware = validateModelRequestBody(RequiredModel);

      const req = {body: {}, method: "POST", path: "/required"} as any;
      const res = {} as any;
      expect(() => {
        middleware(req, res, () => {});
      }).toThrow();
    });

    it("respects excludeFields option", () => {
      const middleware = validateModelRequestBody(RequiredModel, {
        excludeFields: ["name"],
      });

      // Without 'name' required, empty body passes
      let nextCalled = false;
      const req = {body: {}, method: "POST", path: "/required"} as any;
      const res = {} as any;
      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
    });
  });

  describe("getSchemaFromModel", () => {
    it("returns properties for a Mongoose model", () => {
      const schema = getSchemaFromModel(RequiredModel);
      expect(schema.name).toBeDefined();
      expect(schema.about).toBeDefined();
    });
  });

  describe("getOpenApiValidatorConfig", () => {
    it("returns a shallow copy of the config", () => {
      configureOpenApiValidator({removeAdditional: false});
      const config = getOpenApiValidatorConfig();
      expect(config.removeAdditional).toBe(false);

      // Mutating the returned copy should not affect internal state
      (config as any).removeAdditional = true;
      expect(getOpenApiValidatorConfig().removeAdditional).toBe(false);
    });
  });
});
