import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import type {User} from "../auth";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {createIsPermitted} from "./middleware";
import {OwnerScope} from "./scopes";
import {terrenoStatements} from "./statements";

const appStatements = {
  ...terrenoStatements,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

const createUser = (
  overrides: Partial<User & {roles: string[]}> = {}
): User & {
  roles: string[];
} => {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id as unknown as User["_id"],
    admin: false,
    id: id.toString(),
    roles: [],
    ...overrides,
  };
};

describe("rbac scopes", () => {
  it("OwnerScope allows admins to bypass ownership checks", async () => {
    const scope = OwnerScope();
    const admin = createUser({admin: true});
    const ownerId = new mongoose.Types.ObjectId().toString();

    const checkResult = await scope.check?.({
      action: "update",
      doc: {ownerId},
      user: admin,
    });
    const filterResult = await scope.filter?.({
      action: "update",
      user: admin,
    });

    expect(checkResult).toBe(true);
    expect(filterResult).toEqual({});
  });

  it("OwnerScope restricts non-admin users to their own documents", async () => {
    const scope = OwnerScope();
    const user = createUser();
    const ownDoc = {ownerId: user.id};
    const otherDoc = {ownerId: new mongoose.Types.ObjectId().toString()};

    expect(
      await scope.check?.({
        action: "update",
        doc: ownDoc,
        user,
      })
    ).toBe(true);
    expect(
      await scope.check?.({
        action: "update",
        doc: otherDoc,
        user,
      })
    ).toBe(false);
    expect(
      await scope.filter?.({
        action: "list",
        user,
      })
    ).toEqual({ownerId: user.id});
  });
});

describe("IsPermitted", () => {
  it("returns a permission method that delegates to access.can", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Reader",
          name: "reader",
          permissions: {todo: ["read"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createUser({roles: ["reader"]});
    const isPermitted = createIsPermitted({can: access.can});
    const check = isPermitted({todo: ["read"]});

    expect(await check("read", user, {_id: "1"})).toBe(true);

    const updateCheck = isPermitted({todo: ["update"]});
    expect(await updateCheck("update", user, {_id: "1"})).toBe(false);
  });
});
