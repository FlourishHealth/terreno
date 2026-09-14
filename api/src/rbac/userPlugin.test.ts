import {describe, expect, it} from "bun:test";
import {Schema} from "mongoose";

import {rbacUserPlugin} from "./userPlugin";

interface TestUser {
  email: string;
  roles: string[];
}

const buildSchema = (): Schema<TestUser> =>
  new Schema<TestUser>({
    email: {description: "Email", type: String},
  });

const resolveDefault = (schema: Schema<TestUser>): unknown => {
  const rolesPath = schema.path("roles") as unknown as {options: {default: () => unknown}};
  return rolesPath.options.default();
};

describe("rbacUserPlugin", () => {
  it("adds roles field with default empty array", () => {
    const schema = buildSchema();
    rbacUserPlugin(schema);

    expect(schema.path("roles")).toBeDefined();
    expect(resolveDefault(schema)).toEqual([]);
  });

  it("assigns configured default roles to new users", () => {
    const schema = buildSchema();
    rbacUserPlugin(schema, {defaultRoles: ["member", "todoUser"]});

    expect(resolveDefault(schema)).toEqual(["member", "todoUser"]);
  });

  it("gives each document its own default roles array", () => {
    const schema = buildSchema();
    rbacUserPlugin(schema, {defaultRoles: ["member"]});

    const first = resolveDefault(schema) as string[];
    first.push("mutated");

    expect(resolveDefault(schema)).toEqual(["member"]);
  });

  it("ignores later mutations of the caller's defaultRoles array", () => {
    const schema = buildSchema();
    const defaultRoles = ["member"];
    rbacUserPlugin(schema, {defaultRoles});
    defaultRoles.push("sneaky");

    expect(resolveDefault(schema)).toEqual(["member"]);
  });
});
