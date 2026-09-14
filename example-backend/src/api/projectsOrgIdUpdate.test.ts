import {beforeEach, describe, it} from "bun:test";
import {
  applySyncMutation,
  findSyncEntryByCollectionTag,
  generateTokens,
  Membership,
  ORGANIZATION_ID_IMMUTABLE_TITLE,
  Organization,
  registerSync,
  TerrenoApp,
  type User,
} from "@terreno/api";
import {assert} from "chai";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import supertest from "supertest";
import {Project} from "../models/project";
import {User as UserModel} from "../models/user";
import {projectOrgContextPlugin, projectRouter} from "./projects";

describe("projects organizationId immutability", () => {
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

  it("rejects REST PATCH attempts to retarget organizationId", async () => {
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

    assert.equal(res.status, 400);
    assert.equal(res.body.title, ORGANIZATION_ID_IMMUTABLE_TITLE);

    const reloaded = await Project.findById(created._id);
    assert.equal(String(reloaded?.organizationId), orgA);
    assert.equal(reloaded?.title, "stay or move");
  });

  it("rejects sync mutation updates that retarget organizationId", async () => {
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

    assert.equal(outcome.type, "nack");
    if (outcome.type === "nack") {
      assert.equal(outcome.nack.code, "validation");
      assert.equal(outcome.nack.message, ORGANIZATION_ID_IMMUTABLE_TITLE);
    }

    const reloaded = await Project.findById(created._id);
    assert.equal(String(reloaded?.organizationId), orgA);
    assert.equal(reloaded?.title, "sync move");
  });
});
