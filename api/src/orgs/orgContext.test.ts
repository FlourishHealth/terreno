import {beforeEach, describe, it} from "bun:test";
import {authAsUser as loginWithPassword} from "@terreno/test";
import {assert} from "chai";
import {type Application, Router} from "express";
import mongoose, {model, Schema} from "mongoose";
import type {PassportLocalMongooseDocument} from "passport-local-mongoose";
import qs from "qs";
import {modelRouter} from "../api";
import {
  type UserModel as AuthUserModel,
  addAuthRoutes,
  authenticateMiddleware,
  setupAuth,
} from "../auth";
import {apiErrorMiddleware, apiUnauthorizedMiddleware} from "../errors";
import {Permissions} from "../permissions";
import {getBaseServer} from "../tests";
import {type User, UserModel} from "../tests/models";
import {Membership, Organization} from "./organizationModel";
import {orgContextMiddleware} from "./orgContext";
import {OrgQueryFilter} from "./orgPermissions";
import {orgScopedPlugin} from "./orgPlugin";

interface OrgProject {
  organizationId: mongoose.Types.ObjectId;
  title: string;
}

const projectSchema = new Schema<OrgProject>(
  {
    title: {description: "Project title", required: true, type: String},
  },
  {strict: "throw"}
);
projectSchema.plugin(orgScopedPlugin);

const OrgProjectModel =
  (mongoose.models.OrgProject as mongoose.Model<OrgProject> | undefined) ??
  model<OrgProject>("OrgProject", projectSchema);

const PASSWORD = "testpassword123";

const setPassword = async (user: User, password: string): Promise<void> => {
  await (user as unknown as PassportLocalMongooseDocument).setPassword(password);
  await (user as unknown as {save: () => Promise<void>}).save();
};

const createUser = async (args: {email: string; roles?: string[]}): Promise<User> => {
  const user = await UserModel.create({
    email: args.email,
    name: args.email,
    roles: args.roles ?? [],
  });
  await setPassword(user, PASSWORD);
  return user;
};

describe("org context middleware and OrgQueryFilter", () => {
  let app: Application;

  beforeEach(async () => {
    await Promise.all([
      Membership.deleteMany({}),
      Organization.deleteMany({}),
      OrgProjectModel.deleteMany({}),
      UserModel.deleteMany({}),
    ]);
    await OrgProjectModel.syncIndexes();

    app = getBaseServer();
    setupAuth(app, UserModel as unknown as AuthUserModel);
    addAuthRoutes(app, UserModel as unknown as AuthUserModel);
    app.use(apiUnauthorizedMiddleware);

    const tenant = Router();
    tenant.use(authenticateMiddleware());
    tenant.use(orgContextMiddleware({required: true}));
    tenant.use(
      modelRouter(OrgProjectModel, {
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [],
          list: [Permissions.IsAuthenticated],
          read: [Permissions.IsOrganizationMember],
          update: [],
        },
        queryFields: ["title", "organizationId"],
        queryFilter: OrgQueryFilter,
      })
    );
    app.use("/projects", tenant);
    app.use(apiErrorMiddleware);
  });

  it("returns 400 when an operator omits X-Organization-Id on a scoped list", async () => {
    await createUser({email: "operator@example.com", roles: ["operator"]});
    const agent = await loginWithPassword(app, {
      email: "operator@example.com",
      password: PASSWORD,
    });

    const res = await agent.get("/projects");
    assert.equal(res.status, 400);
  });

  it("scopes an org-admin of exactly one org when the header is omitted", async () => {
    const admin = await createUser({email: "orgadmin@example.com"});
    const orgA = await Organization.create({name: "Org A", ownerId: admin._id});
    const orgB = await Organization.create({name: "Org B", ownerId: admin._id});
    await Membership.create({
      organizationId: orgA._id,
      roleName: "org-admin",
      userId: admin._id,
    });
    await OrgProjectModel.create({organizationId: orgA._id, title: "Alpha"});
    await OrgProjectModel.create({organizationId: orgB._id, title: "Bravo"});

    const agent = await loginWithPassword(app, {
      email: "orgadmin@example.com",
      password: PASSWORD,
    });
    const res = await agent.get("/projects");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].title, "Alpha");
  });

  it("does not return org B rows for an org A member including $or and query-param attacks", async () => {
    const member = await createUser({email: "member@example.com"});
    const orgA = await Organization.create({name: "Tenant A", ownerId: member._id});
    const orgB = await Organization.create({name: "Tenant B", ownerId: member._id});
    await Membership.create({
      organizationId: orgA._id,
      roleName: "member",
      userId: member._id,
    });
    await OrgProjectModel.create({organizationId: orgA._id, title: "Keep"});
    await OrgProjectModel.create({organizationId: orgB._id, title: "Leak"});

    const agent = await loginWithPassword(app, {
      email: "member@example.com",
      password: PASSWORD,
    });
    const headers = {"X-Organization-Id": orgA._id.toString()};

    const listed = await agent.get("/projects").set(headers);
    assert.equal(listed.status, 200);
    assert.deepEqual(
      listed.body.data.map((row: {title: string}) => row.title),
      ["Keep"]
    );

    const byParam = await agent
      .get("/projects")
      .query({organizationId: orgB._id.toString()})
      .set(headers);
    assert.equal(byParam.status, 200);
    assert.deepEqual(
      byParam.body.data.map((row: {title: string}) => row.title),
      ["Keep"]
    );

    const orAttack = await agent
      .get(`/projects?${qs.stringify({$or: [{organizationId: orgB._id.toString()}]})}`)
      .set(headers);
    assert.equal(orAttack.status, 200);
    const leaked = (orAttack.body.data as Array<{title: string}>).some((row) => {
      return row.title === "Leak";
    });
    assert.isFalse(leaked);
  });

  it("returns 403 when a non-member sends X-Organization-Id", async () => {
    const outsider = await createUser({email: "outsider@example.com"});
    const org = await Organization.create({name: "Closed", ownerId: outsider._id});
    const agent = await loginWithPassword(app, {
      email: "outsider@example.com",
      password: PASSWORD,
    });

    const res = await agent.get("/projects").set("X-Organization-Id", org._id.toString());
    assert.equal(res.status, 403);
  });

  it("returns 400 when an org-admin of many orgs omits the header", async () => {
    const admin = await createUser({email: "multiadmin@example.com"});
    const orgA = await Organization.create({name: "Multi A", ownerId: admin._id});
    const orgB = await Organization.create({name: "Multi B", ownerId: admin._id});
    await Membership.create({
      organizationId: orgA._id,
      roleName: "org-admin",
      userId: admin._id,
    });
    await Membership.create({
      organizationId: orgB._id,
      roleName: "org-admin",
      userId: admin._id,
    });
    const agent = await loginWithPassword(app, {
      email: "multiadmin@example.com",
      password: PASSWORD,
    });
    const res = await agent.get("/projects");
    assert.equal(res.status, 400);
  });
});
