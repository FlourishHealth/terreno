import {describe, it} from "bun:test";
import {assert} from "chai";

import type {User} from "../auth";
import {
  authorizeAdminBroadcastDocument,
  clearAdminBroadcastScopes,
  isAdminBroadcastSocketRoom,
  registerAdminBroadcastScope,
} from "./adminBroadcastScope";

const adminUser = {admin: true, id: "u-admin"} as User;

describe("adminBroadcastScope", () => {
  it("treats an unregistered model as unscoped", async () => {
    clearAdminBroadcastScopes();
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {ownerId: "other"},
        modelName: "Missing",
        user: adminUser,
      }),
      "unscoped"
    );
  });

  it("denies when list permission fails", async () => {
    clearAdminBroadcastScopes();
    registerAdminBroadcastScope("Scoped", {
      listPermissions: [() => false],
      readPermissions: [() => true],
    });
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {ownerId: "other"},
        modelName: "Scoped",
        user: adminUser,
      }),
      "deny"
    );
  });

  it("denies when queryFilter excludes the document", async () => {
    clearAdminBroadcastScopes();
    registerAdminBroadcastScope("Scoped", {
      listPermissions: [() => true],
      queryFilter: () => ({tenantId: "acme"}),
      readPermissions: [() => true],
    });
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {tenantId: "other"},
        modelName: "Scoped",
        user: adminUser,
      }),
      "deny"
    );
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {tenantId: "acme"},
        modelName: "Scoped",
        user: adminUser,
      }),
      "allow"
    );
  });

  it("denies when queryFilter returns null", async () => {
    clearAdminBroadcastScopes();
    registerAdminBroadcastScope("Scoped", {
      listPermissions: [() => true],
      queryFilter: () => null,
      readPermissions: [() => true],
    });
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {tenantId: "acme"},
        modelName: "Scoped",
        user: adminUser,
      }),
      "deny"
    );
  });

  it("allows when queryFilter is omitted", async () => {
    clearAdminBroadcastScopes();
    registerAdminBroadcastScope("Scoped", {
      listPermissions: [() => true],
      readPermissions: [() => true],
    });
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {ownerId: "other"},
        modelName: "Scoped",
        user: adminUser,
      }),
      "allow"
    );
  });

  it("denies when queryFilter throws", async () => {
    clearAdminBroadcastScopes();
    registerAdminBroadcastScope("Scoped", {
      listPermissions: [() => true],
      queryFilter: () => {
        throw new Error("filter exploded");
      },
      readPermissions: [() => true],
    });
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {ownerId: "other"},
        modelName: "Scoped",
        user: adminUser,
      }),
      "deny"
    );
  });

  it("denies when the user is missing", async () => {
    clearAdminBroadcastScopes();
    registerAdminBroadcastScope("Scoped", {
      listPermissions: [() => true],
      readPermissions: [() => true],
    });
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {ownerId: "other"},
        modelName: "Scoped",
      }),
      "deny"
    );
  });

  it("denies when read permission fails", async () => {
    clearAdminBroadcastScopes();
    registerAdminBroadcastScope("Scoped", {
      listPermissions: [() => true],
      readPermissions: [() => false],
    });
    assert.equal(
      await authorizeAdminBroadcastDocument({
        doc: {ownerId: "other"},
        modelName: "Scoped",
        user: adminUser,
      }),
      "deny"
    );
  });

  it("identifies the admin broadcast socket room", () => {
    assert.isTrue(isAdminBroadcastSocketRoom("sync:todos|admin", "todos"));
    assert.isFalse(isAdminBroadcastSocketRoom("sync:todos|owner:u1", "todos"));
  });
});
