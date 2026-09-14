import {beforeEach, describe, expect, it, spyOn} from "bun:test";
import mongoose, {model, Schema} from "mongoose";

import type {UserModel} from "../auth";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {backfillAdmins} from "./backfillAdmins";
import {terrenoStatements} from "./statements";
import {rbacUserPlugin} from "./userPlugin";

interface BackfillUser {
  admin: boolean;
  email: string;
  roles: string[];
}

const backfillUserSchema = new Schema<BackfillUser>({
  admin: {default: false, description: "Whether the user is an admin", type: Boolean},
  email: {description: "The user's email", type: String},
});
rbacUserPlugin(backfillUserSchema);

const BackfillUserModel = model<BackfillUser>("BackfillAdminsUser", backfillUserSchema);

const asUserModel = (): UserModel => BackfillUserModel as unknown as UserModel;

const createAccessForTest = () =>
  createAccess({
    connection: mongoose.connection,
    statements: terrenoStatements,
  });

const createUser = async (overrides: Partial<BackfillUser> = {}): Promise<string> => {
  const user = await BackfillUserModel.create({
    admin: true,
    email: `${new mongoose.Types.ObjectId().toString()}@example.com`,
    ...overrides,
  });
  return user.id;
};

const findRoles = async (id: string): Promise<string[]> => {
  const user = await BackfillUserModel.findById(id);
  return user?.roles ?? [];
};

describe("backfillAdmins", () => {
  beforeEach(async () => {
    await setupDb();
    await BackfillUserModel.deleteMany({});
  });

  it("reports matched admins without persisting on a dry run", async () => {
    const access = createAccessForTest();
    const invalidateCache = spyOn(access, "invalidateCache");
    const adminId = await createUser();
    await createUser({admin: false});

    const result = await backfillAdmins({access, userModel: asUserModel()});

    expect(result).toEqual({dryRun: true, matched: 1, updated: 1});
    expect(await findRoles(adminId)).toEqual([]);
    expect(invalidateCache).not.toHaveBeenCalled();
  });

  it("assigns the superadmin role and invalidates the cache on a wet run", async () => {
    const access = createAccessForTest();
    const invalidateCache = spyOn(access, "invalidateCache");
    const adminId = await createUser();

    const result = await backfillAdmins({access, userModel: asUserModel(), wetRun: true});

    expect(result).toEqual({dryRun: false, matched: 1, updated: 1});
    expect(await findRoles(adminId)).toEqual(["superadmin"]);
    expect(invalidateCache).toHaveBeenCalledWith({userId: adminId});
  });

  it("preserves existing roles when adding the backfilled role", async () => {
    const access = createAccessForTest();
    const adminId = await createUser({roles: ["member"]});

    const result = await backfillAdmins({access, userModel: asUserModel(), wetRun: true});

    expect(result.updated).toBe(1);
    expect(await findRoles(adminId)).toEqual(["member", "superadmin"]);
  });

  it("skips admins that already have the role", async () => {
    const access = createAccessForTest();
    const invalidateCache = spyOn(access, "invalidateCache");
    await createUser({roles: ["superadmin"]});
    const missingRoleId = await createUser();

    const result = await backfillAdmins({access, userModel: asUserModel(), wetRun: true});

    expect(result).toEqual({dryRun: false, matched: 2, updated: 1});
    expect(invalidateCache).toHaveBeenCalledTimes(1);
    expect(invalidateCache).toHaveBeenCalledWith({userId: missingRoleId});
  });

  it("supports a custom role name", async () => {
    const access = createAccessForTest();
    const adminId = await createUser();

    const result = await backfillAdmins({
      access,
      roleName: "supportAdmin",
      userModel: asUserModel(),
      wetRun: true,
    });

    expect(result).toEqual({dryRun: false, matched: 1, updated: 1});
    expect(await findRoles(adminId)).toEqual(["supportAdmin"]);
  });

  it("returns zero counts when there are no admins", async () => {
    const access = createAccessForTest();
    await createUser({admin: false});

    const result = await backfillAdmins({access, userModel: asUserModel(), wetRun: true});

    expect(result).toEqual({dryRun: false, matched: 0, updated: 0});
  });
});
