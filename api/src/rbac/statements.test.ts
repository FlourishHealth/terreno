import {describe, expect, it} from "bun:test";

import {
  ADMIN_PAGE_PERMISSION,
  expandRolePermissions,
  mergeStatements,
  READ_ACTIONS,
  READ_ONLY_ROLE_PERMISSIONS,
  terrenoStatements,
} from "./statements";

describe("rbac statements", () => {
  it("exports terreno default vocabulary", () => {
    expect(terrenoStatements.admin).toContain("access");
    expect(ADMIN_PAGE_PERMISSION).toEqual({admin: ["access"]});
    expect(terrenoStatements.rbac).toContain("manageRoles");
    expect(terrenoStatements.user).toContain("read");
    expect(terrenoStatements.configuration).toContain("update");
    expect(terrenoStatements.featureFlag).toEqual(["create", "list", "read", "update", "delete"]);
    expect(terrenoStatements.consentForm).toEqual(["create", "list", "read", "update", "delete"]);
    expect(terrenoStatements.consentResponse).toEqual(["list", "read"]);
  });

  it("merges app statements over terreno defaults", () => {
    const merged = mergeStatements({
      patient: ["create", "read", "update"],
      user: ["read"],
    });

    expect(merged.admin).toEqual(terrenoStatements.admin);
    expect(merged.patient).toEqual(["create", "read", "update"]);
    expect(merged.user).toEqual(["read"]);
  });

  it("expands wildcard permissions to every action", () => {
    const expanded = expandRolePermissions("*", terrenoStatements, READ_ACTIONS);

    expect(expanded.admin).toEqual([...terrenoStatements.admin]);
    expect(expanded.user).toEqual([...terrenoStatements.user]);
    expect(expanded.featureFlag).toEqual([...terrenoStatements.featureFlag]);
    expect(expanded.consentForm).toEqual([...terrenoStatements.consentForm]);
    expect(expanded.consentResponse).toEqual([...terrenoStatements.consentResponse]);
  });

  it("expands read-only sentinel to read-ish actions", () => {
    const expanded = expandRolePermissions(
      READ_ONLY_ROLE_PERMISSIONS,
      terrenoStatements,
      READ_ACTIONS
    );

    expect(expanded.admin).toBeUndefined();
    expect(expanded.user).toEqual(["list", "read"]);
    expect(expanded.rbac).toEqual(["read"]);
    expect(expanded.configuration).toEqual(["read"]);
    expect(expanded.featureFlag).toEqual(["list", "read"]);
    expect(expanded.consentForm).toEqual(["list", "read"]);
    expect(expanded.consentResponse).toEqual(["list", "read"]);
  });

  it("returns concrete permission sets unchanged", () => {
    const permissions = {patient: ["read"]};
    const expanded = expandRolePermissions(permissions, terrenoStatements, READ_ACTIONS);

    expect(expanded).toEqual(permissions);
  });
});
