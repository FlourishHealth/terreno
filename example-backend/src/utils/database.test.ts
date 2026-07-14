import {describe, it} from "bun:test";
import {assert} from "chai";
import {resolveMongoDbName} from "./database";

describe("resolveMongoDbName", () => {
  it("returns the PR-specific database name", () => {
    assert.equal(resolveMongoDbName("terreno-example-pr-869"), "terreno-example-pr-869");
  });

  it("trims the configured database name", () => {
    assert.equal(resolveMongoDbName("  terreno-example-pr-42  "), "terreno-example-pr-42");
  });

  it("does not override the database from MONGO_URI when unset", () => {
    assert.isUndefined(resolveMongoDbName());
    assert.isUndefined(resolveMongoDbName("   "));
  });
});
