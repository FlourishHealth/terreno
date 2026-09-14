import {describe, expect, it} from "bun:test";

import {
  formatConflictFieldLabel,
  formatConflictFieldValue,
  getChangedConflictFields,
  NO_CONFLICT_DIFF_FIELDS,
  parseConflictPayload,
  summarizeConflictSide,
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

  it("ignores sync metadata fields when diffing", () => {
    const local = {__v: 1, _syncSeq: 5, title: "same", updated: "2024-01-01"};
    const server = {__v: 2, _syncSeq: 9, title: "same", updated: "2024-02-02"};
    expect(getChangedConflictFields({local, server})).toEqual([]);
  });

  it("parses object payloads and rejects non-object JSON", () => {
    expect(parseConflictPayload('{"title":"local"}')).toEqual({title: "local"});
    expect(parseConflictPayload("42")).toEqual({});
    expect(parseConflictPayload("null")).toEqual({});
  });

  it("formats snake case and leading capital labels", () => {
    expect(formatConflictFieldLabel("due_date")).toBe("Due date");
    expect(formatConflictFieldLabel("assignedUserId")).toBe("Assigned User Id");
  });

  it("formats every value shape", () => {
    expect(formatConflictFieldValue(null)).toBe("None");
    expect(formatConflictFieldValue("plain")).toBe("plain");
    expect(formatConflictFieldValue(12)).toBe("12");
    expect(formatConflictFieldValue({nested: true})).toBe('{"nested":true}');

    const truncated = formatConflictFieldValue({long: "x".repeat(200)});
    expect(truncated).toHaveLength(121);
    expect(truncated.endsWith("…")).toBe(true);
  });

  it("summarizes a conflict side by title, field count, or empty diff", () => {
    expect(summarizeConflictSide({changedFields: ["completed"], data: {title: "Buy milk"}})).toBe(
      "Buy milk"
    );
    expect(summarizeConflictSide({changedFields: [], data: {title: ""}})).toBe(
      NO_CONFLICT_DIFF_FIELDS
    );
    expect(summarizeConflictSide({changedFields: ["completed"], data: {}})).toBe("1 changed field");
    expect(summarizeConflictSide({changedFields: ["completed", "title"], data: {}})).toBe(
      "2 changed fields"
    );
  });
});
