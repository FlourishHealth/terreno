import {describe, it} from "bun:test";
import {assert} from "chai";
import mongoose from "mongoose";

import type {User} from "../auth";
import {createAccess} from "../rbac/access";
import {createRbacRoleModel} from "../rbac/roleModel";
import {terrenoStatements} from "../rbac/statements";
import {setupDb} from "../tests";
import type {MembershipDocument} from "../types/membership";
import type {OrganizationDocument} from "../types/organization";
import {type ResolvedOrgContext, runWithOrgContext} from "./orgContext";

const createTestUser = (
  overrides: Partial<User & {roles: string[]}> = {}
): User & {roles: string[]} => {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id as unknown as User["_id"],
    admin: false,
    id: id.toString(),
    roles: [],
    ...overrides,
  };
};

const orgAdminContext = (): ResolvedOrgContext => ({
  membership: {roleName: "org-admin", status: "active"} as MembershipDocument,
  organization: {_id: new mongoose.Types.ObjectId()} as OrganizationDocument,
});

describe("optional organizations", () => {
  it("does not seed operator or grant membership org-admin without organizations: true", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      statements: terrenoStatements,
    });
    await access.roles.seedDefaults();

    const RbacRole = createRbacRoleModel(mongoose.connection);
    assert.isNull(await RbacRole.findOne({name: "operator"}));

    const operatorList = await access.can({
      permissions: {organization: ["list"]},
      user: createTestUser({roles: ["operator"]}),
    });
    assert.isFalse(operatorList.allowed);

    const orgAdminUpdate = await runWithOrgContext(orgAdminContext(), () =>
      access.can({
        permissions: {organization: ["update"]},
        user: createTestUser(),
      })
    );
    assert.isFalse(orgAdminUpdate.allowed);
  });

  it("seeds operator and grants membership org-admin when organizations is true", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      organizations: true,
      statements: terrenoStatements,
    });
    await access.roles.seedDefaults();

    const RbacRole = createRbacRoleModel(mongoose.connection);
    const operator = await RbacRole.findExactlyOne({name: "operator"});
    assert.isTrue(operator.isLocked);
    assert.deepEqual(operator.permissions.organization, [...terrenoStatements.organization]);

    const operatorList = await access.can({
      permissions: {organization: ["list"]},
      user: createTestUser({roles: ["operator"]}),
    });
    assert.isTrue(operatorList.allowed);

    const orgAdminUpdate = await runWithOrgContext(orgAdminContext(), () =>
      access.can({
        permissions: {organization: ["update"]},
        user: createTestUser(),
      })
    );
    assert.isTrue(orgAdminUpdate.allowed);
  });
});
