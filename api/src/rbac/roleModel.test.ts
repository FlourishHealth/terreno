import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {setupDb} from "../tests";
import {createRbacRoleModel, expandRolePermissions, terrenoDefaultRoles} from "./roleModel";
import {READ_ONLY_ROLE_PERMISSIONS, terrenoStatements} from "./statements";

describe("rbac role model", () => {
  it("defines terreno default roles with expected names", () => {
    const names = terrenoDefaultRoles.map((role) => role.name);

    expect(names).toEqual(["superadmin", "admin", "auditor", "member"]);
  });

  it("seeds default roles with expanded permissions", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: terrenoStatements});

    const superadmin = await RbacRole.findExactlyOne({name: "superadmin"});
    expect(superadmin.isSealed).toBe(true);
    expect(superadmin.permissions.admin).toContain("access");
    expect(superadmin.permissions.user).toContain("delete");
    expect(superadmin.permissions.featureFlag).toContain("list");
    expect(superadmin.permissions.consentForm).toContain("list");
    expect(superadmin.permissions.consentResponse).toEqual(["list", "read"]);

    const auditor = await RbacRole.findExactlyOne({name: "auditor"});
    expect(auditor.permissions.user).toEqual(["list", "read"]);
    expect(auditor.permissions.rbac).toEqual(["read"]);
  });

  it("upserts default roles without duplicating", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: terrenoStatements});
    await RbacRole.seedDefaults({statements: terrenoStatements});

    const defaultRoleNames = terrenoDefaultRoles.map((role) => role.name);
    const roles = await RbacRole.find({name: {$in: defaultRoleNames}});
    expect(roles).toHaveLength(terrenoDefaultRoles.length);
  });

  it("does not overwrite customized unsealed roles on re-seed", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: terrenoStatements});
    await RbacRole.updateOne({name: "admin"}, {$set: {permissions: {user: ["read"]}}});
    await RbacRole.seedDefaults({statements: terrenoStatements});

    const admin = await RbacRole.findExactlyOne({name: "admin"});
    expect(admin.permissions.user).toEqual(["read"]);
  });

  it("refreshes sealed default roles on re-seed", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: terrenoStatements});
    await RbacRole.updateOne({name: "superadmin"}, {$set: {permissions: {user: ["read"]}}});
    await RbacRole.seedDefaults({statements: terrenoStatements});

    const superadmin = await RbacRole.findExactlyOne({name: "superadmin"});
    expect(superadmin.permissions.admin).toContain("access");
    expect(superadmin.permissions.user).toContain("delete");
  });

  it("expands read-only sentinel at seed time", () => {
    const auditor = terrenoDefaultRoles.find((role) => role.name === "auditor");
    expect(auditor?.permissions).toBe(READ_ONLY_ROLE_PERMISSIONS);

    const expanded = expandRolePermissions(
      auditor?.permissions ?? READ_ONLY_ROLE_PERMISSIONS,
      terrenoStatements
    );
    expect(expanded.configuration).toEqual(["read"]);
  });
});
