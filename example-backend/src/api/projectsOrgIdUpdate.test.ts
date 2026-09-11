import {beforeEach, describe, expect, it} from "bun:test";
import {
  applySyncMutation,
  findSyncEntryByCollectionTag,
  generateTokens,
  Membership,
  Organization,
  registerSync,
  TerrenoApp,
  type User,
} from "@terreno/api";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import supertest from "supertest";
import {Project} from "../models/project";
import {User as UserModel} from "../models/user";
import {projectOrgContextPlugin, projectRouter} from "./projects";

/**
 * Reproduction for Defect B: organizationId can change after creation across REST,
 * admin PATCH, and sync mutation update when the caller belongs to both tenants.
 */
describe("projects organizationId update escape (Defect B reproduction)", () => {
  let orgA: string;
  let orgB: string;

  const getUserScopes = async (user: User): Promise<string[]> => {
    const memberships = await Membership.findActiveForUser(user.id);
    return memberships.map((membership) => String(membership.organizationId));
  };

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
      userModel: UserModel as never,
    })
      .register(projectOrgContextPlugin)
      .register(projectRouter)
      .build();
  };

  const createUser = async (email: string, admin = false) => {
    return UserModel.register(
      {admin, email, name: email} as never,
      "password12345"
    ) as unknown as Promise<{
      _id: mongoose.Types.ObjectId;
      admin: boolean;
    }>;
  };

  beforeEach(async () => {
    await Project.collection.deleteMany({});
    await UserModel.deleteMany({});
    await Membership.deleteMany({});
    await Organization.deleteMany({});

    const ownerId = new mongoose.Types.ObjectId();
    const organizations = await Organization.create([
      {name: "Org A", ownerId},
      {name: "Org B", ownerId},
    ]);
    orgA = String(organizations[0]._id);
    orgB = String(organizations[1]._id);

    if (!findSyncEntryByCollectionTag("projects")) {
      const syncConfig = projectRouter.options.sync;
      if (!syncConfig) {
        throw new Error("Project sync config is required");
      }
      registerSync({
        config: syncConfig,
        model: projectRouter.model,
        options: projectRouter.options,
        routePath: projectRouter.path,
      });
    }
  });

  it("REST PATCH retargets organizationId when caller belongs to both orgs", async () => {
    const app = buildApp();
    const user = await createUser("patch-move@example.com");
    await Membership.create({organizationId: orgA, userId: user._id});
    await Membership.create({organizationId: orgB, userId: user._id});
    const created = await Project.create({organizationId: orgA, title: "stay or move"});
    const {token} = await generateTokens(user);

    const res = await supertest(app)
      .patch(`/projects/${created._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Organization-Id", orgA)
      .send({organizationId: orgB});

    expect(res.status).toBe(200);
    expect(res.body.data.organizationId).toBe(orgB);

    const reloaded = await Project.findById(created._id);
    expect(String(reloaded?.organizationId)).toBe(orgB);
  });

  it("sync mutation update retargets organizationId when caller belongs to both orgs", async () => {
    const user = await createUser("sync-move@example.com");
    await Membership.create({organizationId: orgA, userId: user._id});
    await Membership.create({organizationId: orgB, userId: user._id});
    const created = await Project.create({organizationId: orgA, title: "sync move"});
    const baseVersion = (created as unknown as {_syncSeq?: number})._syncSeq ?? 0;

    const outcome = await applySyncMutation({
      mutation: {
        baseVersion,
        collection: "projects",
        data: {organizationId: orgB, title: "sync moved"},
        id: String(created._id),
        mutationId: `org-move-${DateTime.utc().toMillis()}`,
        operation: "update",
      },
      scopeResolver: getUserScopes,
      user: {_id: String(user._id), admin: false, id: String(user._id)} as User,
    });

    expect(outcome.type).toBe("ack");
    const reloaded = await Project.findById(created._id);
    expect(String(reloaded?.organizationId)).toBe(orgB);
    expect(reloaded?.title).toBe("sync moved");
  });
});
