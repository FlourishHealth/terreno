import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import type {Router} from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {type ModelRouterOptions, modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {setupServer} from "./expressServer";
import {Permissions} from "./permissions";
import {FoodModel, setupDb, UserModel} from "./tests";

function getMessageSummaryOpenApiMiddleware(options: Partial<ModelRouterOptions<any>>): any {
  return options.openApi.path({
    parameters: [
      {
        in: "query",
        name: "foodIds",
        schema: {
          type: "string",
        },
      },
    ],
    responses: {
      200: {
        content: {
          "application/json": {
            schema: {
              properties: {
                message: {
                  type: "string",
                },
              },
              type: "object",
            },
          },
        },
        description: "Success",
      },
    },
    tags: ["Food"],
  });
}

function addRoutes(router: Router, options?: Partial<ModelRouterOptions<any>>): void {
  router.use(
    "/food",
    modelRouter(FoodModel as any, {
      ...options,
      allowAnonymous: true,
      openApiExtraModelProperties: {
        foo: {
          type: "string",
        },
      },
      permissions: {
        create: [Permissions.IsAny],
        delete: [Permissions.IsAny],
        list: [Permissions.IsAny],
        read: [Permissions.IsAny],
        update: [Permissions.IsAny],
      },
      populatePaths: [{path: "ownerId"}, {path: "eatenBy"}],
      queryFields: ["calories"],
    })
  );
  router.use("/food/count", getMessageSummaryOpenApiMiddleware, async (_req, res) => {
    res.json({message: "count"});
  });
}

describe("openApi", () => {
  let server: TestAgent;
  let app: express.Application;

  beforeEach(async () => {
    process.env.REFRESH_TOKEN_SECRET = "testsecret1234";
    process.env.ENABLE_SWAGGER = "true";

    const result = setupServer({
      addRoutes,
      skipListen: true,
      userModel: UserModel as any,
    });
    app = result.app;
    setupAuth(app, UserModel as any);
    addAuthRoutes(app, UserModel as any);
  });

  it("gets the openapi.json", async () => {
    server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);
    expect(res.body).toMatchSnapshot();
  });

  it("gets the openapi.json with ETag header", async () => {
    server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);
    expect(res.headers.etag).toBeDefined();
    expect(res.headers.etag).toMatch(/^"[a-f0-9]{16}"$/);
  });

  it("returns 304 when If-None-Match matches ETag", async () => {
    server = supertest(app);

    // First request to get the ETag
    const firstRes = await server.get("/openapi.json").expect(200);
    const etag = firstRes.headers.etag;
    expect(etag).toBeDefined();

    // Second request with If-None-Match header
    const secondRes = await server.get("/openapi.json").set("If-None-Match", etag).expect(304);

    expect(secondRes.body).toEqual({});
    expect(secondRes.headers.etag).toBe(etag);
  });

  it("returns 200 when If-None-Match does not match ETag", async () => {
    server = supertest(app);

    // Request with a different ETag
    const res = await server
      .get("/openapi.json")
      .set("If-None-Match", '"different-etag"')
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.headers.etag).toBeDefined();
    expect(res.headers.etag).not.toBe('"different-etag"');
  });

  it("gets the swagger ui", async () => {
    server = supertest(app);
    await server.get("/swagger/").expect(200);
  });

  it("gets food with populated paths", async () => {
    server = supertest(app);
    const [_admin, notAdmin] = await setupDb();
    const food = await FoodModel.create({
      name: "test",
      ownerId: notAdmin._id,
    });
    const res = await server.get(`/food/${food._id}`).expect(200);
    expect(res.body.data.ownerId._id).toEqual(notAdmin._id.toString());
  });

  // create a test for a custom express endpoint that doesnt use modelRouter and manually adds it
  // to openapi
  it("gets the openapi.json with custom endpoint", async () => {
    server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);
    expect(res.body).toMatchSnapshot();
  });

  it("gets the openapi.json and has correct Number query fields", async () => {
    server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);
    const foodQuery = res.body.paths["/food/"].get.parameters.find((p) => p.name === "calories");

    // Ensure that a Number query field supports gt/gte/lt/lte and just a Number
    expect(foodQuery.schema).toEqual({
      oneOf: [
        {type: "number"},
        {
          properties: {
            $gt: {type: "number"},
            $gte: {type: "number"},
            $lt: {type: "number"},
            $lte: {type: "number"},
          },
          type: "object",
        },
      ],
    });
    expect(foodQuery).toMatchSnapshot();
  });
});

function addRoutesPopulate(router: Router, options?: Partial<ModelRouterOptions<any>>): void {
  options?.openApi.component("schemas", "LimitedUser", {
    properties: {
      email: {
        description: "LimitedUser's email",
        type: "string",
      },
      name: {
        description: "LimitedUser's name",
        type: "string",
      },
    },
    type: "object",
  });

  router.use(
    "/food",
    modelRouter(FoodModel as any, {
      ...options,
      allowAnonymous: true,
      openApiExtraModelProperties: {
        foo: {
          type: "string",
        },
      },
      permissions: {
        create: [Permissions.IsAny],
        delete: [Permissions.IsAny],
        list: [Permissions.IsAny],
        read: [Permissions.IsAny],
        update: [Permissions.IsAny],
      },
      populatePaths: [
        {fields: ["name", "email"], path: "ownerId"},
        {
          fields: ["name", "email"],
          openApiComponent: "LimitedUser",
          path: "eatenBy",
        },
        {
          fields: ["name", "email"],
          openApiComponent: "LimitedUser",
          path: "likesIds.userId",
        },
      ],
    })
  );
}

describe("openApi without swagger", () => {
  let server: TestAgent;
  let app: express.Application;

  beforeEach(async () => {
    process.env.REFRESH_TOKEN_SECRET = "testsecret1234";
    process.env.ENABLE_SWAGGER = "false";

    const result = setupServer({
      addRoutes,
      skipListen: true,
      userModel: UserModel as any,
    });
    app = result.app;
    setupAuth(app, UserModel as any);
    addAuthRoutes(app, UserModel as any);
  });

  it("does not have the swagger ui", async () => {
    server = supertest(app);
    await server.get("/swagger/").expect(404);
  });
});

describe("openApi populate", () => {
  let server: TestAgent;
  let app: express.Application;

  beforeEach(async () => {
    process.env.REFRESH_TOKEN_SECRET = "testsecret1234";

    const result = setupServer({
      addRoutes: addRoutesPopulate,
      skipListen: true,
      userModel: UserModel as any,
    });
    app = result.app;
    setupAuth(app, UserModel as any);
    addAuthRoutes(app, UserModel as any);
  });

  it("gets the openapi.json with populate", async () => {
    server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);
    const properties =
      res.body.paths["/food/{id}"].get.responses["200"].content["application/json"].schema
        .properties;

    // There's no component here, so we automatically generate the limited properties.
    expect(properties.ownerId).toEqual({
      properties: {
        email: {
          type: "string",
        },
        name: {
          type: "string",
        },
      },
      type: "object",
    });

    // We only reference the component here, rather than listing each field each time.
    expect(properties.eatenBy).toEqual({
      items: {
        $ref: "#/components/schemas/LimitedUser",
      },
      type: "array",
    });

    expect(properties.likesIds).toEqual({
      items: {
        properties: {
          _id: {
            type: "string",
          },
          likes: {
            type: "boolean",
          },
          userId: {
            $ref: "#/components/schemas/LimitedUser",
          },
        },
        required: [],
        type: "object",
      },
      type: "array",
    });

    // Ensure the component is registered and used.
    expect(res.body.components.schemas.LimitedUser).toEqual({
      properties: {
        email: {
          description: "LimitedUser's email",
          type: "string",
        },
        name: {
          description: "LimitedUser's name",
          type: "string",
        },
      },
      type: "object",
    });

    expect(res.body).toMatchSnapshot();
  });
});
