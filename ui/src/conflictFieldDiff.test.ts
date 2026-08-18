import {describe, expect, it} from "bun:test";

import {
  formatConflictFieldLabel,
  formatConflictFieldValue,
  getChangedConflictFields,
  parseConflictPayload,
} from "./conflictFieldDiff";

describe("conflictFieldDiff", () => {
  it("returns only fields that differ between local and server payloads", () => {
    const local = {completed: true, title: "local", unchanged: "same"};
    const server = {completed: false, title: "server", unchanged: "same"};
    expect(getChangedConflictFields({local, server})).toEqual(["completed", "title"]);
  });

  it("formats labels and values for display", () => {
    expect(formatConflictFieldLabel("completed")).toBe("Completed");
    expect(formatConflictFieldValue(true)).toBe("true");
    expect(formatConflictFieldValue(undefined)).toBe("Not set");
  });

  it("parses invalid JSON payloads as empty objects", () => {
    expect(parseConflictPayload("not-json")).toEqual({});
  });
});
