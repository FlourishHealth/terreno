import {describe, expect, it} from "bun:test";
import {Schema} from "mongoose";

import {rbacUserPlugin} from "./userPlugin";

interface TestUser {
  email: string;
  roles: string[];
}

describe("rbacUserPlugin", () => {
  it("adds roles field with default empty array", () => {
    const schema = new Schema<TestUser>({
      email: {description: "Email", type: String},
    });
    rbacUserPlugin(schema);

    const rolesPath = schema.path("roles");
    expect(rolesPath).toBeDefined();
    expect((rolesPath as unknown as {options: {default: unknown}}).options.default).toEqual([]);
  });
});
