// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import {type Model, model, Schema} from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";
import {z} from "zod";
import {ACTION_NAME_PATTERN, defineCollectionAction, defineInstanceAction} from "./actions";
import {modelRouter} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {apiUnauthorizedMiddleware} from "./errors";
import {Permissions} from "./permissions";
import {type IsDeleted, isDeletedPlugin} from "./plugins";
import {authAsUser, type Food, FoodModel, getBaseServer, setupDb, UserModel} from "./tests";

interface Stuff extends IsDeleted {
  _id: string;
  name: string;
  ownerId: string;
}

const stuffSchema = new Schema<Stuff>({
  name: {type: String},
  ownerId: {type: String},
});
stuffSchema.plugin(isDeletedPlugin);
const StuffModel = model<Stuff>("ActionStuff", stuffSchema);

const allPermissions = {
  create: [Permissions.IsAny],
  delete: [Permissions.IsAny],
  list: [Permissions.IsAny],
  read: [Permissions.IsAny],
  update: [Permissions.IsAny],
};

describe("modelRouter actions", () => {
  describe("registration validation", () => {
    it("throws when permissions are missing", () => {
      expect(() =>
        modelRouter(FoodModel, {
          collectionActions: {
            broken: {
              handler: async () => ({ok: true}),
              method: "POST",
            } as any,
          },
          permissions: allPermissions,
        })
      ).toThrow(/missing required "permissions"/);
    });

    it("rejects single-character action names by design", () => {
      expect(() =>
        modelRouter(FoodModel, {
          collectionActions: {
            a: {
              handler: async () => ({}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        })
      ).toThrow(ACTION_NAME_PATTERN.toString());
    });

    it("throws on invalid action name", () => {
      expect(() =>
        modelRouter(FoodModel, {
          collectionActions: {
            "foo*bar": {
              handler: async () => ({}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        })
      ).toThrow(ACTION_NAME_PATTERN.toString());
    });

    it("throws on empty action name", () => {
      expect(() =>
        modelRouter(FoodModel, {
          collectionActions: {
            "": {
              handler: async () => ({}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        })
      ).toThrow("Action name cannot be empty");
    });

    it("throws when instance action collides with array field", () => {
      expect(() =>
        modelRouter(FoodModel, {
          instanceActions: {
            tags: {
              handler: async () => ({}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        })
      ).toThrow(/collides with array field/);
    });

    it("allows same action name on instance and collection scopes", () => {
      expect(() =>
        modelRouter(FoodModel, {
          collectionActions: {
            sync: {
              handler: async () => ({scope: "collection"}),
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          instanceActions: {
            sync: {
              handler: async () => ({scope: "instance"}),
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        })
      ).not.toThrow();
    });
  });

  describe("integration", () => {
    let app: express.Application;
    let server: TestAgent;
    let admin: any;
    let notAdmin: any;
    let spinach: Food;

    const mountFoodRouter = (options: Parameters<typeof modelRouter<Food>>[1]): void => {
      app.use(
        "/food",
        modelRouter(FoodModel, {
          allowAnonymous: true,
          ...options,
        })
      );
      if (!app.get("terrenoUnauthorizedMiddleware")) {
        app.use(apiUnauthorizedMiddleware);
        app.set("terrenoUnauthorizedMiddleware", true);
      }
    };

    beforeEach(async () => {
      process.env.REFRESH_TOKEN_SECRET = "testsecret1234";
      [admin, notAdmin] = await setupDb();
      [spinach] = await Promise.all([
        FoodModel.create({
          calories: 1,
          created: new Date(),
          hidden: false,
          name: "Spinach",
          ownerId: notAdmin._id,
          source: {name: "test"},
        }),
      ]);
      app = getBaseServer();
      setupAuth(app, UserModel as any);
      addAuthRoutes(app, UserModel as any);
      server = supertest(app);
    });

    describe("routing and permissions", () => {
      it("allows empty permissions array and returns 405 at runtime", async () => {
        mountFoodRouter({
          collectionActions: {
            disabled: {
              handler: async () => ({ok: true}),
              method: "POST",
              permissions: [],
            },
          },
          permissions: allPermissions,
        });
        const agent = await authAsUser(app, "admin");
        const res = await agent.post("/food/disabled").send({}).expect(405);
        expect(res.body.title).toContain("Access to CREATE on Food denied");
      });

      it("runs instance POST action with ctx.doc and req.obj", async () => {
        let seenDoc: Food | undefined;
        let seenObj: Food | undefined;
        mountFoodRouter({
          instanceActions: {
            mark: {
              handler: async ({doc, req}) => {
                seenDoc = doc;
                seenObj = (req as express.Request & {obj?: Food}).obj;
                return {marked: true};
              },
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post(`/food/${spinach._id}/mark`).send({}).expect(200);
        expect(res.body.data).toEqual({marked: true});
        expect(seenDoc?._id.toString()).toBe(spinach._id.toString());
        expect(seenObj?._id.toString()).toBe(spinach._id.toString());
      });

      it("runs collection POST action without doc", async () => {
        mountFoodRouter({
          collectionActions: {
            bulk: {
              handler: async (ctx) => {
                expect((ctx as {doc?: unknown}).doc).toBeUndefined();
                return {count: 1};
              },
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post("/food/bulk").send({}).expect(200);
        expect(res.body.data).toEqual({count: 1});
      });

      it("runs GET instance and collection actions", async () => {
        mountFoodRouter({
          collectionActions: {
            stats: {
              handler: async () => ({total: 1}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          instanceActions: {
            peek: {
              handler: async ({doc}) => ({name: doc?.name}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const collectionRes = await server.get("/food/stats").expect(200);
        expect(collectionRes.body.data).toEqual({total: 1});
        const instanceRes = await server.get(`/food/${spinach._id}/peek`).expect(200);
        expect(instanceRes.body.data).toEqual({name: "Spinach"});
      });

      it("returns 404 for missing instance doc", async () => {
        mountFoodRouter({
          instanceActions: {
            peek: {
              handler: async () => ({}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const missingId = "507f1f77bcf86cd799439011";
        const res = await server.get(`/food/${missingId}/peek`).expect(404);
        expect(res.body.title).toContain(missingId);
        expect(res.body.meta).toBeUndefined();
      });

      it("returns 404 with soft-delete metadata on instance action", async () => {
        await StuffModel.deleteMany({});
        const doc = await StuffModel.create({deleted: true, name: "hidden", ownerId: "1"});
        app = getBaseServer();
        setupAuth(app, UserModel as any);
        addAuthRoutes(app, UserModel as any);
        app.use(
          "/stuff",
          modelRouter(StuffModel as Model<Stuff>, {
            allowAnonymous: true,
            instanceActions: {
              peek: {
                handler: async () => ({}),
                method: "GET",
                permissions: [Permissions.IsAny],
              },
            },
            permissions: allPermissions,
          })
        );
        const agent = await authAsUser(app, "notAdmin");
        const res = await agent.get(`/stuff/${doc._id}/peek`).expect(404);
        expect(res.body.meta).toEqual({deleted: "true"});
      });

      it("returns 401 when unauthenticated and IsAuthenticated required", async () => {
        mountFoodRouter({
          allowAnonymous: false,
          collectionActions: {
            secure: {
              handler: async () => ({ok: true}),
              method: "POST",
              permissions: [Permissions.IsAuthenticated],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post("/food/secure").send({}).expect(401);
        expect(res.body.title).toBe("Unauthorized");
      });

      it("returns 405 for collection action when pre-doc permission denied", async () => {
        mountFoodRouter({
          collectionActions: {
            adminOnly: {
              handler: async () => ({ok: true}),
              method: "POST",
              permissions: [Permissions.IsAdmin],
            },
          },
          permissions: allPermissions,
        });
        const agent = await authAsUser(app, "notAdmin");
        const res = await agent.post("/food/adminOnly").send({}).expect(405);
        expect(res.body.title).toContain("Access to CREATE on Food denied");
      });

      it("returns 403 for instance action when post-doc permission denied", async () => {
        const adminFood = await FoodModel.create({
          calories: 2,
          created: new Date(),
          hidden: false,
          name: "AdminApple",
          ownerId: admin._id,
          source: {name: "test"},
        });
        mountFoodRouter({
          instanceActions: {
            ownerOnly: {
              handler: async () => ({ok: true}),
              method: "POST",
              permissions: [Permissions.IsOwner],
            },
          },
          permissions: allPermissions,
        });
        const agent = await authAsUser(app, "notAdmin");
        const res = await agent.post(`/food/${adminFood._id}/ownerOnly`).send({}).expect(403);
        expect(res.body.title).toContain(`Access to UPDATE on Food:${adminFood._id} denied`);
      });

      it("allows IsAuthenticatedOrReadOnly on GET with allowAnonymous", async () => {
        mountFoodRouter({
          allowAnonymous: true,
          instanceActions: {
            publicRead: {
              handler: async () => ({ok: true}),
              method: "GET",
              permissions: [Permissions.IsAuthenticatedOrReadOnly],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.get(`/food/${spinach._id}/publicRead`).expect(200);
        expect(res.body.data).toEqual({ok: true});
      });
    });

    describe("validation", () => {
      it("passes valid body through ctx", async () => {
        let seenEmail: string | undefined;
        mountFoodRouter({
          collectionActions: {
            notify: {
              body: z.object({email: z.string().email()}),
              handler: async ({body}) => {
                seenEmail = (body as {email: string}).email;
                return {sent: true};
              },
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        await server.post("/food/notify").send({email: "a@b.com"}).expect(200);
        expect(seenEmail).toBe("a@b.com");
      });

      it("returns 400 with meta.fields for invalid body", async () => {
        mountFoodRouter({
          collectionActions: {
            notify: {
              body: z.object({email: z.string().email()}),
              handler: async () => ({sent: true}),
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post("/food/notify").send({email: "not-an-email"}).expect(400);
        expect(res.body.title).toBe("Validation failed");
        expect(res.body.meta.fields.email).toBeDefined();
      });

      it("validates query schema into ctx without mutating req.query", async () => {
        let seenQ: number | undefined;
        let originalQ: unknown;
        mountFoodRouter({
          collectionActions: {
            search: {
              handler: async ({query, req}) => {
                seenQ = (query as {count: number}).count;
                originalQ = req.query.count;
              },
              method: "GET",
              permissions: [Permissions.IsAny],
              query: z.object({count: z.coerce.number()}),
            },
          },
          permissions: allPermissions,
        });
        await server.get("/food/search?count=5").expect(200);
        expect(seenQ).toBe(5);
        expect(originalQ).toBe("5");
      });

      it("coerces body values via zod in ctx", async () => {
        let seenCount: number | undefined;
        mountFoodRouter({
          collectionActions: {
            tally: {
              body: z.object({count: z.coerce.number()}),
              handler: async ({body}) => {
                const parsed = body as {count: number};
                seenCount = parsed.count;
                return {count: parsed.count};
              },
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post("/food/tally").send({count: "5"}).expect(200);
        expect(seenCount).toBe(5);
        expect(res.body.data).toEqual({count: 5});
      });

      it("strips unknown body fields by default", async () => {
        let seenBody: Record<string, unknown> = {};
        mountFoodRouter({
          collectionActions: {
            strictish: {
              body: z.object({known: z.string()}),
              handler: async ({body}) => {
                seenBody = body as Record<string, unknown>;
                return {ok: true};
              },
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        await server.post("/food/strictish").send({extra: "x", known: "y"}).expect(200);
        expect(seenBody).toEqual({known: "y"});
      });
    });

    describe("response shape", () => {
      it("wraps handler return in data envelope", async () => {
        mountFoodRouter({
          collectionActions: {
            echo: {
              handler: async () => ({x: 1}),
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post("/food/echo").send({}).expect(200);
        expect(res.body).toEqual({data: {x: 1}});
      });

      it("respects custom status code", async () => {
        mountFoodRouter({
          collectionActions: {
            queue: {
              handler: async () => ({queued: true}),
              method: "POST",
              permissions: [Permissions.IsAny],
              status: 202,
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post("/food/queue").send({}).expect(202);
        expect(res.body).toEqual({data: {queued: true}});
      });

      it("returns data null for undefined handler return", async () => {
        mountFoodRouter({
          collectionActions: {
            noop: {
              handler: async () => undefined,
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post("/food/noop").send({}).expect(200);
        expect(res.body).toEqual({data: null});
      });

      it("skips auto-wrap when res.headersSent", async () => {
        mountFoodRouter({
          collectionActions: {
            custom: {
              handler: async ({res}) => {
                res.json({custom: 1});
              },
              method: "POST",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.post("/food/custom").send({}).expect(200);
        expect(res.body).toEqual({custom: 1});
      });

      it("allows custom list-style envelope via res.json", async () => {
        mountFoodRouter({
          collectionActions: {
            paged: {
              handler: async ({res}) => {
                res.json({data: [{id: 1}], more: false, page: 1, total: 1});
              },
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.get("/food/paged").expect(200);
        expect(res.body).toEqual({data: [{id: 1}], more: false, page: 1, total: 1});
        expect(res.body.data).not.toHaveProperty("data");
      });
    });

    describe("co-registration precedence", () => {
      it("instance action wins over endpoints route on same path", async () => {
        mountFoodRouter({
          endpoints: (router) => {
            router.get("/:id/foo", (_req, res) => {
              res.json({data: {from: "endpoints"}});
            });
          },
          instanceActions: {
            foo: {
              handler: async () => ({from: "action"}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          permissions: allPermissions,
        });
        const res = await server.get(`/food/${spinach._id}/foo`).expect(200);
        expect(res.body.data).toEqual({from: "action"});
      });

      it("collection action wins over endpoints route on same path", async () => {
        mountFoodRouter({
          collectionActions: {
            report: {
              handler: async () => ({from: "action"}),
              method: "GET",
              permissions: [Permissions.IsAny],
            },
          },
          endpoints: (router) => {
            router.get("/report", (_req, res) => {
              res.json({data: {from: "endpoints"}});
            });
          },
          permissions: allPermissions,
        });
        const res = await server.get("/food/report").expect(200);
        expect(res.body.data).toEqual({from: "action"});
      });
    });
  });

  describe("defineInstanceAction type ergonomics", () => {
    it("preserves handler types at compile time", () => {
      interface ScheduleDoc {
        _id: string;
        publishedAt?: Date;
      }

      const action = defineInstanceAction<ScheduleDoc, {notifyUsers: boolean}>({
        body: z.object({notifyUsers: z.boolean()}),
        handler: async ({body, doc}) => {
          const _doc: ScheduleDoc = doc;
          const _notify: boolean = body.notifyUsers;
          return {notify: _notify, publishedAt: _doc.publishedAt?.toISOString() ?? null};
        },
        method: "POST",
        permissions: [Permissions.IsAny],
      });

      expect(action.method).toBe("POST");
    });

    it("defineCollectionAction preserves body types", () => {
      const action = defineCollectionAction({
        body: z.object({ids: z.array(z.string())}),
        handler: async ({body}) => {
          const _ids: string[] = body.ids;
          return {count: _ids.length};
        },
        method: "POST",
        permissions: [Permissions.IsAny],
      });
      expect(action.method).toBe("POST");
    });
  });
});
