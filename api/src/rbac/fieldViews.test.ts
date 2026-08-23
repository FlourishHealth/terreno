import {describe, expect, it} from "bun:test";

import {applyReadMask, getDisallowedWriteKeys} from "./fieldViews";

describe("fieldViews", () => {
  it("applyReadMask picks only allowed read paths", () => {
    const doc = {name: "Todo", ownerId: "u1", secret: "hidden"};
    const masked = applyReadMask(doc, {omit: [], read: ["name", "ownerId"], write: ["name"]});
    expect(masked).toEqual({name: "Todo", ownerId: "u1"});
  });

  it("applyReadMask omits nested paths without mutating the original document", () => {
    const profile = {email: "a@b.com", phone: "555"};
    const doc = {profile};
    const masked = applyReadMask(doc, {
      omit: ["profile.phone"],
      read: "*",
      write: "*",
    });
    expect(masked).toEqual({profile: {email: "a@b.com"}});
    expect(profile.phone).toBe("555");
  });

  it("getDisallowedWriteKeys rejects nested keys outside a dotted write mask", () => {
    const disallowed = getDisallowedWriteKeys(
      {profile: {email: "a@b.com", phone: "555"}},
      {omit: [], read: "*", write: ["profile.email"]}
    );
    expect(disallowed).toEqual(["profile.phone"]);
  });

  it("getDisallowedWriteKeys rejects keys outside the write mask", () => {
    const disallowed = getDisallowedWriteKeys(
      {admin: true, name: "x"},
      {omit: [], read: "*", write: ["name"]}
    );
    expect(disallowed).toEqual(["admin"]);
  });
});
