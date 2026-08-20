import {describe, expect, it} from "bun:test";
import {model, Schema} from "mongoose";

import type {AdminConfig} from "./adminTypes";
import {scrubAdminFields, stripAdminBodyFields} from "./scrubAdminFields";

const userSchema = new Schema({
  email: String,
  hash: String,
  name: String,
  salt: String,
});

model("ScrubUser", userSchema);

const todoSchema = new Schema({
  ownerId: {ref: "ScrubUser", type: Schema.Types.ObjectId},
  title: String,
});

const Todo = model("ScrubTodo", todoSchema);

describe("scrubAdminFields", () => {
  const todoAdmin: AdminConfig = {
    displayName: "Todos",
    excludeFields: ["secret"],
    hiddenFields: ["internalNote"],
    listFields: ["title"],
  };

  const userAdmin: AdminConfig = {
    displayName: "Users",
    excludeFields: ["hash", "salt"],
    listFields: ["email", "name"],
  };

  it("strips exclude and hidden fields at the top level", () => {
    const result = scrubAdminFields(
      {internalNote: "n", secret: "x", title: "Buy milk"},
      {admin: todoAdmin}
    );
    expect(result).toEqual({title: "Buy milk"});
  });

  it("scrubs nested arrays", () => {
    const result = scrubAdminFields(
      [
        {secret: "1", title: "a"},
        {internalNote: "2", title: "b"},
      ],
      {admin: todoAdmin}
    );
    expect(result).toEqual([{title: "a"}, {title: "b"}]);
  });

  it("scrubs populated refs using the referenced model admin config", () => {
    const populated = {
      ownerId: {
        _id: "507f1f77bcf86cd799439011",
        email: "a@b.com",
        hash: "hidden",
        name: "Alice",
        salt: "hidden",
      },
      title: "Task",
    };

    const result = scrubAdminFields(populated, {
      admin: todoAdmin,
      allModelAdmins: {ScrubUser: userAdmin},
      schema: Todo.schema,
    }) as {ownerId: Record<string, unknown>; title: string};

    expect(result.title).toBe("Task");
    expect(result.ownerId).toEqual({
      _id: "507f1f77bcf86cd799439011",
      email: "a@b.com",
      name: "Alice",
    });
  });

  it("returns unconfigured populated docs unchanged", () => {
    const populated = {
      ownerId: {_id: "507f1f77bcf86cd799439011", hash: "keep", name: "Alice"},
      title: "Task",
    };

    const result = scrubAdminFields(populated, {
      admin: todoAdmin,
      schema: Todo.schema,
    }) as {ownerId: Record<string, unknown>};

    expect(result.ownerId.hash).toBe("keep");
  });
});

describe("stripAdminBodyFields", () => {
  const admin: AdminConfig = {
    displayName: "Todos",
    excludeFields: ["role"],
    hiddenFields: ["internal"],
    listFields: ["title"],
    readonlyFields: ["slug"],
  };

  it("removes readonly, exclude, and hidden keys from objects", () => {
    const result = stripAdminBodyFields(
      {internal: "n", role: "admin", slug: "fixed", title: "x"},
      admin
    );
    expect(result).toEqual({title: "x"});
  });
});
