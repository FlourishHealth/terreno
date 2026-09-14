import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import mongoose from "mongoose";

import {Membership, Organization} from "./organizationModel";

const userId = (): mongoose.Types.ObjectId => new mongoose.Types.ObjectId();

describe("Organization and Membership models", () => {
  beforeEach(async () => {
    await Membership.deleteMany({});
    await Organization.deleteMany({});
    await Membership.syncIndexes();
    await Organization.syncIndexes();
  });

  it("rejects a second membership for the same organization and user", async () => {
    const org = await Organization.create({
      name: "Acme",
      ownerId: userId(),
    });
    const memberUserId = userId();
    await Membership.create({
      organizationId: org._id,
      userId: memberUserId,
    });

    let error: unknown;
    try {
      await Membership.create({
        organizationId: org._id,
        roleName: "org-admin",
        userId: memberUserId,
      });
    } catch (caughtError) {
      error = caughtError;
    }

    assert.instanceOf(error, Error);
    assert.match((error as Error).message, /duplicate key/i);
  });

  it("declares a unique compound index on organizationId and userId", async () => {
    const indexes = await Membership.collection.indexes();
    const unique = indexes.find((index) => {
      return Boolean(index.unique && index.key.organizationId === 1 && index.key.userId === 1);
    });

    assert.isDefined(unique);
  });

  it("generates a unique slug from the organization name", async () => {
    const org = await Organization.create({
      name: "Acme Corp",
      ownerId: userId(),
    });

    assert.equal(org.slug, "acme-corp");
    assert.equal(org.disabled, false);

    let error: unknown;
    try {
      await Organization.create({
        name: "Acme Corp",
        ownerId: userId(),
      });
    } catch (caughtError) {
      error = caughtError;
    }

    assert.instanceOf(error, Error);
    assert.match((error as Error).message, /duplicate key/i);
  });

  it("defaults membership roleName to member and status to active", async () => {
    const org = await Organization.create({
      name: "Defaults",
      ownerId: userId(),
    });
    const membership = await Membership.create({
      organizationId: org._id,
      userId: userId(),
    });

    assert.equal(membership.roleName, "member");
    assert.equal(membership.status, "active");
  });

  it("finds active memberships and distinguishes org-admin from member", async () => {
    const orgA = await Organization.create({
      name: "Org A",
      ownerId: userId(),
    });
    const orgB = await Organization.create({
      name: "Org B",
      ownerId: userId(),
    });
    const adminUserId = userId();
    const memberUserId = userId();

    await Membership.create({
      organizationId: orgA._id,
      roleName: "org-admin",
      userId: adminUserId,
    });
    await Membership.create({
      organizationId: orgB._id,
      roleName: "member",
      status: "suspended",
      userId: adminUserId,
    });
    await Membership.create({
      organizationId: orgA._id,
      roleName: "member",
      userId: memberUserId,
    });

    const activeForAdmin = await Membership.findActiveForUser(adminUserId);
    assert.equal(activeForAdmin.length, 1);
    assert.equal(activeForAdmin[0]?.organizationId.toString(), orgA._id.toString());
    assert.isTrue(await Membership.isOrgAdmin(adminUserId, orgA._id));
    assert.isFalse(await Membership.isOrgAdmin(memberUserId, orgA._id));
    assert.isTrue(await Membership.isMember(adminUserId, orgA._id));
    assert.isTrue(await Membership.isMember(memberUserId, orgA._id));
    assert.isFalse(await Membership.isMember(adminUserId, orgB._id));
  });

  it("rejects a name that cannot become a slug", async () => {
    let error: unknown;
    try {
      await Organization.create({
        name: "!!!",
        ownerId: userId(),
      });
    } catch (caughtError) {
      error = caughtError;
    }

    assert.instanceOf(error, Error);
    assert.equal((error as {title?: string}).title, "Organization name must produce a slug");
  });

  it("accepts string ids on membership statics", async () => {
    const org = await Organization.create({
      name: "String Ids",
      ownerId: userId(),
    });
    const memberUserId = userId();
    await Membership.create({
      organizationId: org._id,
      roleName: "org-admin",
      userId: memberUserId,
    });

    assert.isTrue(await Membership.isOrgAdmin(memberUserId.toString(), org._id.toString()));
    assert.isTrue(await Membership.isMember(memberUserId.toString(), org._id.toString()));
  });

  it("forwards construct, apply, has, set, and prototype through the lazy model proxy", () => {
    assert.isTrue("create" in Organization);
    assert.equal(Object.getPrototypeOf(Organization), mongoose.Model);
    const previous = (Organization as unknown as {debugLabel?: string}).debugLabel;
    (Organization as unknown as {debugLabel?: string}).debugLabel = "org-proxy";
    assert.equal((Organization as unknown as {debugLabel?: string}).debugLabel, "org-proxy");
    (Organization as unknown as {debugLabel?: string}).debugLabel = previous;
    const constructed = new (
      Organization as unknown as new (doc: {
        name: string;
        ownerId: mongoose.Types.ObjectId;
      }) => {name: string}
    )({
      name: "Proxy Construct",
      ownerId: userId(),
    });
    assert.equal(constructed.name, "Proxy Construct");
    const applied = (
      Organization as unknown as (doc: {name: string; ownerId: mongoose.Types.ObjectId}) => {
        name: string;
      }
    )({
      name: "Proxy Apply",
      ownerId: userId(),
    });
    assert.equal(applied.name, "Proxy Apply");
  });
});
