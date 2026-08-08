import {describe, expect, it} from "bun:test";

import type {ModelRouterOptions} from "../api";
import {Permissions} from "../permissions";
import {buildListQuery} from "./query";
import type {MCPConfig, MCPToolArgs} from "./types";

interface TestDoc {
  completed: boolean;
  ownerId: string;
  title: string;
}

const baseOptions: ModelRouterOptions<TestDoc> = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsOwner],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsOwner],
  },
  queryFields: ["completed", "title"],
};

const build = (args: MCPToolArgs, config: MCPConfig = {}, options = baseOptions) => {
  return buildListQuery({args, config, options});
};

describe("buildListQuery", () => {
  it("keeps exact matches on allowed fields", () => {
    const {query} = build({completed: true});

    expect(query).toEqual({completed: true});
  });

  it("drops pagination and population args", () => {
    const {query} = build({limit: 10, page: 2, populate: "ownerId", sort: "-title"});

    expect(query).toEqual({});
  });

  it("drops undefined values", () => {
    const {query} = build({completed: undefined, title: "keep"});

    expect(query).toEqual({title: "keep"});
  });

  it("ignores fields outside queryFields", () => {
    const {query} = build({secret: "nope", title: "keep"});

    expect(query).toEqual({title: "keep"});
  });

  it("starts from defaultQueryParams", () => {
    const {query} = build(
      {title: "keep"},
      {},
      {...baseOptions, defaultQueryParams: {archived: false}}
    );

    expect(query).toEqual({archived: false, title: "keep"});
  });

  it("ignores a queryField that is also excluded from MCP", () => {
    const {query} = build({completed: true, title: "keep"}, {excludeFields: ["completed"]});

    expect(query).toEqual({title: "keep"});
  });

  it("allows comparison operators", () => {
    const {query} = build({title: {$in: ["a", "b"]}});

    expect(query).toEqual({title: {$in: ["a", "b"]}});
  });

  it("allows nested comparison operators inside arrays", () => {
    const {query} = build({$or: [{title: {$in: ["a"]}}, {completed: {$ne: true}}]});

    expect(query).toEqual({$or: [{title: {$in: ["a"]}}, {completed: {$ne: true}}]});
  });

  it("allows exact matches on embedded objects", () => {
    const {error, query} = build({title: {nested: "value"}});

    expect(error).toBeUndefined();
    expect(query).toEqual({title: {nested: "value"}});
  });

  it("rejects $where", () => {
    const {error, query} = build({title: {$where: "return true"}});

    expect(error).toContain("$where");
    expect(query).toBeUndefined();
  });

  it("rejects $expr nested deeper in the value", () => {
    const {error} = build({title: {$in: [{$expr: 1}]}});

    expect(error).toContain("$expr");
  });

  it("rejects $function inside a logical branch", () => {
    const {error} = build({$and: [{title: {$function: "x"}}]});

    expect(error).toContain("$function");
  });

  it("rejects a logical branch field outside queryFields", () => {
    const {error} = build({$or: [{secret: "leak"}]});

    expect(error).toContain("secret");
  });

  it("rejects a logical operator with a non-array value", () => {
    const {error} = build({$or: {title: "a"}});

    expect(error).toContain("$or");
  });

  it("rejects an empty logical array", () => {
    const {error} = build({$and: []});

    expect(error).toContain("$and");
  });

  it("rejects a logical branch that is not an object", () => {
    const {error} = build({$and: ["title"]});

    expect(error).toContain("$and");
  });

  it("validates nested logical operators", () => {
    const {error, query} = build({$and: [{$or: [{title: "a"}, {completed: true}]}]});

    expect(error).toBeUndefined();
    expect(query).toEqual({$and: [{$or: [{title: "a"}, {completed: true}]}]});
  });

  it("rejects a disallowed field inside a nested logical operator", () => {
    const {error} = build({$and: [{$or: [{secret: "leak"}]}]});

    expect(error).toContain("secret");
  });

  it("does not treat a logical operator as a filterable field", () => {
    const {error} = build({$nor: [{title: "a"}]});

    // $nor is not in the logical allowlist, so it is dropped like any unknown field
    expect(error).toBeUndefined();
  });
});
