import {describe, it} from "bun:test";
import {assert} from "chai";

import type {User} from "../auth";
import type {AnyTerrenoAccess} from "../rbac/types";
import {canUseAdminBroadcastWindow} from "./adminWindowAccess";

const adminUser = {admin: true, id: "u-admin"} as User;
const flagOnlyUser = {admin: true, id: "u-flag"} as User;
const memberUser = {admin: false, id: "u-member"} as User;

describe("canUseAdminBroadcastWindow", () => {
  it("uses user.admin when no RBAC is configured", async () => {
    assert.isTrue(await canUseAdminBroadcastWindow({user: adminUser}));
    assert.isFalse(await canUseAdminBroadcastWindow({user: memberUser}));
  });

  it("requires admin:access when accessControl is configured", async () => {
    const accessControl = {
      can: async () => ({allowed: false}),
    } as unknown as AnyTerrenoAccess;

    assert.isFalse(
      await canUseAdminBroadcastWindow({
        accessControl,
        user: flagOnlyUser,
      })
    );
  });

  it("allows a caller when accessControl grants admin:access", async () => {
    const accessControl = {
      can: async () => ({allowed: true}),
    } as unknown as AnyTerrenoAccess;

    assert.isTrue(
      await canUseAdminBroadcastWindow({
        accessControl,
        user: memberUser,
      })
    );
  });

  it("prefers canOpenAdminWindow over accessControl and user.admin", async () => {
    const accessControl = {
      can: async () => ({allowed: true}),
    } as unknown as AnyTerrenoAccess;

    assert.isFalse(
      await canUseAdminBroadcastWindow({
        accessControl,
        canOpenAdminWindow: () => false,
        user: adminUser,
      })
    );
  });
});
