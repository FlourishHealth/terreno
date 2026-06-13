// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import supertest from "supertest";
import {type ModelRouterOptions, modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {setupServer} from "./expressServer";
import {Permissions} from "./permissions";
import {TerrenoApp} from "./terrenoApp";
import {FoodModel, setupDb, UserModel} from "./tests";
import {z} from "./zodOpenApi";

const foodActionPermissions = {
  create: [Permissions.IsAny],
  delete: [Permissions.IsAny],
  list: [Permissions.IsAny],
  read: [Permissions.IsAny],
  update: [Permissions.IsAny],
};

const foodActionRouterOptions = {
  allowAnonymous: true,
  collectionActions: {
    summarize: {
      body: z
        .object({
          label: z.string(),
        })
        .strict(),
      handler: async ({body}) => ({label: (body as {label: string}).label, total: 1}),
      method: "POST" as const,
      permissions: [Permissions.IsAny],
      response: z.object({label: z.string(), total: z.number()}).strict(),
      summary: "Summarize foods collection",
      tag: "CustomFoodTag",
    },
  },
  instanceActions: {
    ping: {
      handler: async ({doc}) => ({id: String(doc._id)}),
      method: "GET" as const,
      permissions: [Permissions.IsAny],
      response: z.object({id: z.string()}),
      summary: "Ping a food document",
    },
  },
  permissions: foodActionPermissions,
  sort: "-created",
};

const primeActionOpenApiRoutes = async (
  server: ReturnType<typeof supertest>,
  foodId: string
): Promise<void> => {
  await server.get(`/food/${foodId}/ping`).expect(200);
  await server.post("/food/summarize").send({label: "test"}).expect(200);
};

const assertActionOpenApiSpec = (spec: Record<string, unknown>): void => {
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  const collectionPath = paths["/food/summarize"];
  const instancePath = paths["/food/{id}/ping"];

  expect(collectionPath?.post).toBeDefined();
  expect(instancePath?.get).toBeDefined();

  const collectionOp = collectionPath.post as Record<string, unknown>;
  const instanceOp = instancePath.get as Record<string, unknown>;

  expect(collectionOp.operationId).toBe("CustomFoodTag_summarize");
  expect(collectionOp.tags).toEqual(["CustomFoodTag"]);
  expect(collectionOp.summary).toBe("Summarize foods collection");

  expect(instanceOp.operationId).toBe("foods_ping");
  expect(instanceOp.tags).toEqual(["foods"]);
  expect(instanceOp.summary).toBe("Ping a food document");

  const collectionParams = (collectionOp.parameters as {in: string; name: string}[]) ?? [];
  expect(collectionParams.some((p) => p.in === "path" && p.name === "id")).toBe(false);

  const instanceParams =
    (instanceOp.parameters as {in: string; name: string; required?: boolean}[]) ?? [];
  const idParam = instanceParams.find((p) => p.in === "path" && p.name === "id");
  expect(idParam).toBeDefined();
  expect(idParam?.required).toBe(true);

  const collectionRequestSchema = (
    collectionOp.requestBody as {
      content: {"application/json": {schema: {properties: {label: unknown}}}};
    }
  ).content["application/json"].schema;
  expect(collectionRequestSchema.properties?.label).toBeDefined();

  const collectionResponseSchema = (
    collectionOp.responses as {
      "200": {content: {"application/json": {schema: {properties: {data: unknown}}}}};
    }
  )["200"].content["application/json"].schema;
  expect(collectionResponseSchema.properties?.data).toBeDefined();

  const instanceResponseSchema = (
    instanceOp.responses as {
      "200": {content: {"application/json": {schema: {properties: {data: unknown}}}}};
    }
  )["200"].content["application/json"].schema;
  expect(instanceResponseSchema.properties?.data).toBeDefined();
};

describe("action OpenAPI emission", () => {
  let admin: Awaited<ReturnType<typeof setupDb>>[0];
  let foodId: string;

  beforeEach(async () => {
    process.env.REFRESH_TOKEN_SECRET = "testsecret1234";
    process.env.ENABLE_SWAGGER = "true";
    [admin] = await setupDb();
    const food = await FoodModel.create({
      calories: 1,
      hidden: false,
      name: "OpenApiFood",
      ownerId: admin._id,
      source: {name: "test"},
    });
    foodId = String(food._id);
  });

  describe("TerrenoApp", () => {
    it("includes action operations in openapi.json after first request", async () => {
      const foodRegistration = modelRouter("/food", FoodModel, foodActionRouterOptions);
      const app = new TerrenoApp({
        skipListen: true,
        userModel: UserModel as any,
      })
        .register(foodRegistration)
        .build();

      const server = supertest(app);
      await primeActionOpenApiRoutes(server, foodId);

      const specRes = await server.get("/openapi.json").expect(200);
      assertActionOpenApiSpec(specRes.body);
    });
  });

  describe("setupServer", () => {
    let app: express.Application;

    beforeEach(() => {
      const addRoutes = (
        router: express.Router,
        routerOptions?: Partial<ModelRouterOptions<unknown>>
      ): void => {
        router.use(
          "/food",
          modelRouter(FoodModel as any, {...foodActionRouterOptions, ...routerOptions})
        );
      };

      app = setupServer({
        addRoutes,
        skipListen: true,
        userModel: UserModel as any,
      });
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
    });

    it("emits the same action operations on first hit via legacy setupServer", async () => {
      const server = supertest(app);
      await primeActionOpenApiRoutes(server, foodId);

      const specRes = await server.get("/openapi.json").expect(200);
      assertActionOpenApiSpec(specRes.body);
    });
  });
});
