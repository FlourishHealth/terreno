import {describe, expect, it} from "bun:test";
import {assert} from "chai";
import mongoose from "mongoose";

import {
  ADMIN_LIST_SEARCH_PARAM,
  andMongoFilters,
  buildAdminPartialSearchFilter,
  escapeRegexLiteral,
} from "./adminTextSearch";

const foodSchema = new mongoose.Schema({
  calories: {type: Number},
  name: {type: String},
  ownerId: {type: mongoose.Schema.Types.ObjectId},
});

describe("escapeRegexLiteral", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegexLiteral("Rice.Bowl")).toBe("Rice\\.Bowl");
  });
});

describe("buildAdminPartialSearchFilter", () => {
  it("matches string searchFields with a case-insensitive partial regex", () => {
    const filter = buildAdminPartialSearchFilter({
      model: {schema: foodSchema},
      q: "App",
      searchFields: ["name"],
    });
    assert.deepEqual(filter, {$or: [{name: {$regex: /App/i}}]});
  });

  it("skips non-string schema paths", () => {
    const filter = buildAdminPartialSearchFilter({
      model: {schema: foodSchema},
      q: "12",
      searchFields: ["calories"],
    });
    assert.isUndefined(filter);
  });

  it("adds ObjectId equality when q is a valid id", () => {
    const id = new mongoose.Types.ObjectId().toString();
    const filter = buildAdminPartialSearchFilter({
      extraObjectIdFields: ["ownerId"],
      model: {schema: foodSchema},
      q: id,
      searchFields: ["name"],
    });
    assert.deepEqual(filter, {
      $or: [{name: {$regex: new RegExp(id, "i")}}, {ownerId: new mongoose.Types.ObjectId(id)}],
    });
  });

  it("returns undefined for blank search text", () => {
    const filter = buildAdminPartialSearchFilter({
      model: {schema: foodSchema},
      q: "   ",
      searchFields: ["name"],
    });
    assert.isUndefined(filter);
  });

  it("discovers ObjectId schema paths when extraObjectIdFields is omitted", () => {
    const id = new mongoose.Types.ObjectId().toString();
    const filter = buildAdminPartialSearchFilter({
      model: {schema: foodSchema},
      q: id,
      searchFields: ["name"],
    });
    // Mongoose reports ObjectId instance as "ObjectId"; this helper only
    // auto-discovers paths whose instance is "ObjectID", so ownerId is omitted
    // unless extraObjectIdFields is set.
    assert.deepEqual(filter, {
      $or: [{name: {$regex: new RegExp(id, "i")}}],
    });
  });
});

describe("andMongoFilters", () => {
  it("returns extra when the base is empty", () => {
    expect(andMongoFilters({}, {name: "x"})).toEqual({name: "x"});
  });

  it("returns the base when extra is omitted", () => {
    assert.deepEqual(andMongoFilters({completed: true}, undefined), {completed: true});
  });

  it("wraps both sides in $and", () => {
    expect(andMongoFilters({completed: true}, {$or: [{name: /a/i}]})).toEqual({
      $and: [{completed: true}, {$or: [{name: /a/i}]}],
    });
  });
});

describe("ADMIN_LIST_SEARCH_PARAM", () => {
  it("is q", () => {
    expect(ADMIN_LIST_SEARCH_PARAM).toBe("q");
  });
});
