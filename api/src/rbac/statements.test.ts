import {describe, expect, it} from "bun:test";

import {
  expandRolePermissions,
  mergeStatements,
  READ_ACTIONS,
  READ_ONLY_ROLE_PERMISSIONS,
  terrenoStatements,
} from "./statements";

describe("rbac statements", () => {
  it("exports terreno default vocabulary", () => {
    expect(terrenoStatements.admin).toContain("access");
    expect(terrenoStatements.rbac).toContain("manageRoles");
    expect(terrenoStatements.user).toContain("read");
    expect(terrenoStatements.configuration).toContain("update");
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
  });

  it("expands read-only sentinel to read-ish actions", () => {
    const expanded = expandRolePermissions(
      READ_ONLY_ROLE_PERMISSIONS,
      terrenoStatements,
      READ_ACTIONS
    );

    expect(expanded.admin).toEqual(["access"]);
    expect(expanded.user).toEqual(["list", "read"]);
    expect(expanded.rbac).toEqual(["read"]);
    expect(expanded.configuration).toEqual(["read"]);
  });

  it("returns concrete permission sets unchanged", () => {
    const permissions = {patient: ["read"]};
    const expanded = expandRolePermissions(permissions, terrenoStatements, READ_ACTIONS);

    expect(expanded).toEqual(permissions);
  });
});
