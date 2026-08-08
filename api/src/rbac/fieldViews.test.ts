import {describe, expect, it} from "bun:test";

import {applyReadMask, getDisallowedWriteKeys} from "./fieldViews";

describe("fieldViews", () => {
  it("applyReadMask picks only allowed read paths", () => {
    const doc = {name: "Todo", ownerId: "u1", secret: "hidden"};
    const masked = applyReadMask(doc, {omit: [], read: ["name", "ownerId"], write: ["name"]});
    expect(masked).toEqual({name: "Todo", ownerId: "u1"});
  });

  it("applyReadMask omits nested paths from read results", () => {
    const doc = {profile: {email: "a@b.com", phone: "555"}};
    const masked = applyReadMask(doc, {
      omit: ["profile.phone"],
      read: "*",
      write: "*",
    });
    expect(masked).toEqual({profile: {email: "a@b.com"}});
  });

  it("getDisallowedWriteKeys rejects keys outside the write mask", () => {
    const disallowed = getDisallowedWriteKeys(
      {admin: true, name: "x"},
      {omit: [], read: "*", write: ["name"]}
    );
    expect(disallowed).toEqual(["admin"]);
  });
});
