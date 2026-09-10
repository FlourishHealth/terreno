import {beforeEach, describe, it} from "bun:test";
import {authAsUser as loginWithPassword} from "@terreno/test";
import {assert} from "chai";
import type {Application} from "express";
import mongoose from "mongoose";
import type {PassportLocalMongooseDocument} from "passport-local-mongoose";

import {type UserModel as AuthUserModel, addAuthRoutes, setupAuth} from "../auth";
import {apiErrorMiddleware, apiUnauthorizedMiddleware} from "../errors";
import {createAccess} from "../rbac/access";
import {terrenoStatements} from "../rbac/statements";
import {getBaseServer} from "../tests";
import {type User, UserModel} from "../tests/models";
import {Membership, Organization} from "./organizationModel";
import {type OrgAuditEvent, OrgsApp} from "./orgsApp";

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

describe("OrgsApp", () => {
  let app: Application;
  let auditEvents: OrgAuditEvent[];

  beforeEach(async () => {
    await Promise.all([
      Membership.deleteMany({}),
      Organization.deleteMany({}),
      UserModel.deleteMany({}),
    ]);
    auditEvents = [];
    const access = createAccess({
      connection: mongoose.connection,
      statements: terrenoStatements,
      userModel: UserModel as unknown as AuthUserModel,
    });
    await access.roles.seedDefaults();

    app = getBaseServer();
    setupAuth(app, UserModel as unknown as AuthUserModel);
    addAuthRoutes(app, UserModel as unknown as AuthUserModel);
    app.use(apiUnauthorizedMiddleware);
    new OrgsApp({
      access,
      onOrgAudit: (event): void => {
        auditEvents.push(event);
      },
    }).register(app);
    app.use(apiErrorMiddleware);
  });

  it("returns 403 on GET /orgs for org-admin and 200 for operator", async () => {
    const operator = await createUser({email: "operator@example.com", roles: ["operator"]});
    const orgAdmin = await createUser({email: "orgadmin@example.com"});
    const org = await Organization.create({name: "Acme", ownerId: operator._id});
    await Membership.create({
      organizationId: org._id,
      roleName: "org-admin",
      userId: orgAdmin._id,
    });

    const orgAdminAgent = await loginWithPassword(app, {
      email: "orgadmin@example.com",
      password: PASSWORD,
    });
    const denied = await orgAdminAgent.get("/orgs");
    assert.equal(denied.status, 403);

    const operatorAgent = await loginWithPassword(app, {
      email: "operator@example.com",
      password: PASSWORD,
    });
    const listed = await operatorAgent.get("/orgs");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].name, "Acme");
  });

  it("creates an organization without requiring membership", async () => {
    await createUser({email: "operator@example.com", roles: ["operator"]});
    const operatorAgent = await loginWithPassword(app, {
      email: "operator@example.com",
      password: PASSWORD,
    });
    const created = await operatorAgent.post("/orgs").send({name: "New Co"});
    assert.equal(created.status, 201);
    assert.equal(created.body.data.name, "New Co");
    const memberships = await Membership.find({organizationId: created.body.data._id});
    assert.equal(memberships.length, 0);
    assert.equal(auditEvents[0]?.verb, "created");
  });

  it("lists /orgs/mine as orgs the caller admins", async () => {
    const operator = await createUser({email: "operator@example.com", roles: ["operator"]});
    const orgAdmin = await createUser({email: "orgadmin@example.com"});
    const acme = await Organization.create({name: "Acme", ownerId: operator._id});
    await Organization.create({name: "Other", ownerId: operator._id});
    await Membership.create({
      organizationId: acme._id,
      roleName: "org-admin",
      userId: orgAdmin._id,
    });

    const orgAdminAgent = await loginWithPassword(app, {
      email: "orgadmin@example.com",
      password: PASSWORD,
    });
    const mine = await orgAdminAgent.get("/orgs/mine");
    assert.equal(mine.status, 200);
    assert.equal(mine.body.data.length, 1);
    assert.equal(mine.body.data[0].name, "Acme");
  });

  it("lets org-admin read and patch name but not disable", async () => {
    const owner = await createUser({email: "owner@example.com", roles: ["operator"]});
    const orgAdmin = await createUser({email: "orgadmin@example.com"});
    const org = await Organization.create({name: "Acme", ownerId: owner._id});
    await Membership.create({
      organizationId: org._id,
      roleName: "org-admin",
      userId: orgAdmin._id,
    });
    const orgAdminAgent = await loginWithPassword(app, {
      email: "orgadmin@example.com",
      password: PASSWORD,
    });

    const read = await orgAdminAgent.get(`/orgs/${org._id}`);
    assert.equal(read.status, 200);

    const patched = await orgAdminAgent.patch(`/orgs/${org._id}`).send({name: "Acme Renamed"});
    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.name, "Acme Renamed");

    const disable = await orgAdminAgent.patch(`/orgs/${org._id}`).send({disabled: true});
    assert.equal(disable.status, 403);
  });

  it("disables an organization and suspends memberships", async () => {
    const operator = await createUser({email: "operator@example.com", roles: ["operator"]});
    const orgAdmin = await createUser({email: "orgadmin@example.com"});
    const org = await Organization.create({name: "Acme", ownerId: operator._id});
    await Membership.create({
      organizationId: org._id,
      roleName: "org-admin",
      userId: orgAdmin._id,
    });
    const operatorAgent = await loginWithPassword(app, {
      email: "operator@example.com",
      password: PASSWORD,
    });
    const disabled = await operatorAgent.patch(`/orgs/${org._id}`).send({disabled: true});
    assert.equal(disabled.status, 200);
    assert.isTrue(disabled.body.data.disabled);
    const membership = await Membership.findOne({organizationId: org._id});
    assert.equal(membership?.status, "suspended");
    assert.isTrue(auditEvents.some((event) => event.verb === "disabled"));
  });

  it("soft-deletes an organization and suspends memberships", async () => {
    const operator = await createUser({email: "operator@example.com", roles: ["operator"]});
    const orgAdmin = await createUser({email: "orgadmin@example.com"});
    const org = await Organization.create({name: "Acme", ownerId: operator._id});
    await Membership.create({
      organizationId: org._id,
      roleName: "org-admin",
      userId: orgAdmin._id,
    });

    const orgAdminAgent = await loginWithPassword(app, {
      email: "orgadmin@example.com",
      password: PASSWORD,
    });
    const deniedDelete = await orgAdminAgent.delete(`/orgs/${org._id}`);
    assert.equal(deniedDelete.status, 403);

    const operatorAgent = await loginWithPassword(app, {
      email: "operator@example.com",
      password: PASSWORD,
    });
    const deleted = await operatorAgent.delete(`/orgs/${org._id}`);
    assert.equal(deleted.status, 204);

    const gone = await Organization.findOne({_id: org._id});
    assert.isNull(gone);
    const withDeleted = await Organization.findOne({_id: org._id, deleted: true});
    assert.isOk(withDeleted);
    const membership = await Membership.findOne({organizationId: org._id});
    assert.equal(membership?.status, "suspended");
    assert.isTrue(auditEvents.some((event) => event.verb === "deleted"));
  });
});
