// biome-ignore-all lint/suspicious/noExplicitAny: test mock/socket shapes are dynamic
import {beforeEach, describe, expect, it} from "bun:test";
import {
  applySyncMutation,
  generateTokens,
  installSyncSocketHandlers,
  type SyncSocketLike,
  TerrenoApp,
  type User,
} from "@terreno/api";
import supertest from "supertest";
import {Project} from "../models/project";
import {User as UserModel} from "../models/user";
import {projectRouter} from "./projects";

/**
 * D3 regression: `preCreate` must force/validate `organizationId` against the
 * caller's own `organizationIds` rather than trusting a client-supplied value that
 * happens to win because it was spread in after the default. Covers both transports
 * the sync protocol supports — REST (`POST /projects`) and `sync:mutate` (socket and
 * the in-process handler `applySyncMutation`, which the HTTP `/sync/mutate` route
 * also delegates to).
 */
describe("projects tenant create-escape (D3)", () => {
  const orgA = "org-a";
  const orgB = "org-b";

  const buildApp = () => {
    process.env.TOKEN_SECRET = "test-secret";
    process.env.TOKEN_ISSUER = "example-backend-test";
    return new TerrenoApp({
      authOptions: {
        generateJWTPayload: (user: unknown) => ({
          admin: (user as {admin?: boolean}).admin === true,
        }),
      },
      skipListen: true,
      userModel: UserModel as any,
    })
      .register(projectRouter)
      .build();
  };

  const createUser = async (email: string, organizationIds: string[]) => {
    return UserModel.register(
      {email, name: email, organizationIds} as any,
      "password12345"
    ) as unknown as Promise<{_id: unknown; admin: boolean; organizationIds: string[]}>;
  };

  beforeEach(async () => {
    // Project is sync-enabled (syncPlugin forbids multi-document writes like
    // deleteMany, including through Model.deleteMany) — clear via the raw
    // collection instead, matching the convention in api/src/sync/integration.test.ts.
    await Project.collection.deleteMany({});
    await UserModel.deleteMany({});
  });

  describe("over REST", () => {
    it("ignores a caller-supplied organizationId outside the caller's organizations and uses the caller's own org", async () => {
      const app = buildApp();
      const user = await createUser("resta@example.com", [orgA]);
      const {token} = await generateTokens(user);

      const res = await supertest(app)
        .post("/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({organizationId: orgB, title: "escape attempt"});

      // Server ignores/validates the mismatched organizationId — it must not create
      // a document scoped to an org the caller does not belong to.
      expect(res.status).toBe(403);
      expect(await Project.countDocuments({organizationId: orgB})).toBe(0);
    });

    it("creates the project scoped to the caller's own organization when omitted", async () => {
      const app = buildApp();
      const user = await createUser("restb@example.com", [orgA]);
      const {token} = await generateTokens(user);

      const res = await supertest(app)
        .post("/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({title: "default org"});

      expect(res.status).toBe(201);
      expect(res.body.data.organizationId).toBe(orgA);
    });

    it("accepts an explicit organizationId that IS one of the caller's organizations", async () => {
      const app = buildApp();
      const user = await createUser("restc@example.com", [orgA, orgB]);
      const {token} = await generateTokens(user);

      const res = await supertest(app)
        .post("/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({organizationId: orgB, title: "second org"});

      expect(res.status).toBe(201);
      expect(res.body.data.organizationId).toBe(orgB);
    });

    it("rejects a caller with no organizations at all", async () => {
      const app = buildApp();
      const user = await createUser("restd@example.com", []);
      const {token} = await generateTokens(user);

      const res = await supertest(app)
        .post("/projects")
        .set("Authorization", `Bearer ${token}`)
        .send({title: "no org"});

      expect(res.status).toBe(403);
    });
  });

  describe("over sync:mutate (applySyncMutation, shared by HTTP /sync/mutate and the socket handler)", () => {
    // Mirrors the shape `req.user` has over the real HTTP /sync/mutate route
    // (authenticateMiddleware populates it with the full Mongoose user document,
    // organizationIds included) — the preCreate hook under test reads that field.
    const asFullUser = (user: {_id: unknown; organizationIds: string[]}): User =>
      ({
        _id: String(user._id),
        admin: false,
        id: String(user._id),
        organizationIds: user.organizationIds,
      }) as User;

    it("nacks unauthorized when the mutation's organizationId escapes the caller's tenants", async () => {
      const user = await createUser("synca@example.com", [orgA]);

      const outcome = await applySyncMutation({
        mutation: {
          collection: "projects",
          data: {organizationId: orgB, title: "sync escape attempt"},
          mutationId: `d3-sync-${Date.now()}-1`,
          operation: "create",
        },
        user: asFullUser(user),
      });

      expect(outcome.type).toBe("nack");
      if (outcome.type === "nack") {
        expect(outcome.nack.code).toBe("unauthorized");
      }
      expect(await Project.countDocuments({organizationId: orgB})).toBe(0);
    });

    it("acks and scopes to the caller's own organization when organizationId is omitted", async () => {
      const user = await createUser("syncb@example.com", [orgA]);

      const outcome = await applySyncMutation({
        mutation: {
          collection: "projects",
          data: {title: "sync default org"},
          mutationId: `d3-sync-${Date.now()}-2`,
          operation: "create",
        },
        user: asFullUser(user),
      });

      expect(outcome.type).toBe("ack");
      const doc = await Project.findOne({title: "sync default org"});
      expect(doc?.organizationId).toBe(orgA);
    });

    it("denies via the installed socket handler for a subscribed collection", async () => {
      const user = await createUser("syncc@example.com", [orgA]);
      const emitted: {event: string; payload: unknown}[] = [];
      const handlers = new Map<string, (...args: any[]) => any>();
      const socket: SyncSocketLike = {
        decodedToken: {admin: false, id: String(user._id), isAnonymous: false},
        emit: (event, payload) => {
          emitted.push({event, payload});
        },
        id: "socket-1",
        join: async () => {},
        leave: async () => {},
        on: (event, handler) => {
          handlers.set(event, handler);
        },
      };

      installSyncSocketHandlers(null, socket, {
        getUserScopes: () => [orgA],
      });

      const mutateHandler = handlers.get("sync:mutate");
      expect(mutateHandler).toBeDefined();

      // NOTE: the socket path currently authorizes with the synthetic
      // `{_id, admin, id}` user (see D2), which has no organizationIds — so
      // preCreate's tenant check denies here regardless of which organizationId
      // was requested. This still proves the escape attempt is denied (fail
      // closed); D2 restores full-user authorization so a caller CAN create in
      // their own org over the socket transport.
      let ackOrNack: {ack?: unknown; nack?: {code: string}} | undefined;
      await mutateHandler?.(
        {
          collection: "projects",
          data: {organizationId: orgB, title: "socket escape attempt"},
          mutationId: `d3-socket-${Date.now()}`,
          operation: "create",
        },
        (response: {ack?: unknown; nack?: {code: string}}) => {
          ackOrNack = response;
        }
      );

      expect(ackOrNack?.nack?.code).toBe("unauthorized");
      expect(await Project.countDocuments({organizationId: orgB})).toBe(0);
    });
  });
});
