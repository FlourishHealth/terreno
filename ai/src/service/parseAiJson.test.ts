import {describe, expect, it} from "bun:test";

import {normalizeLlmJsonTextForStructuredOutput, parseAiJson} from "./parseAiJson";

describe("parseAiJson", () => {
  it("parses clean JSON without repair", () => {
    const r = parseAiJson<{a: number}>(`{"a":1}`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.repaired).toBe(false);
      expect(r.data).toEqual({a: 1});
    }
  });

  it("strips a fully wrapped ```json fence", () => {
    const r = parseAiJson(`\`\`\`json\n{"b":2}\n\`\`\``);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({b: 2});
    }
  });

  it("extracts JSON from preamble and trailing prose", () => {
    const r = parseAiJson(`Sure! Here is the result: {"ok":true} — hope this helps.`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.repaired).toBe(true);
      expect(r.data).toEqual({ok: true});
    }
  });

  it("handles nested objects and arrays in balanced extraction", () => {
    const r = parseAiJson(`noise {"x":[1,{"y":2}]} tail`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({x: [1, {y: 2}]});
    }
  });

  it("repairs trailing commas outside strings", () => {
    const r = parseAiJson(`{"a":1,}`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.repaired).toBe(true);
      expect(r.data).toEqual({a: 1});
    }
  });

  it("repairs smart quotes on property names via aggressive normalization", () => {
    const r = parseAiJson(`{“smart”: true}`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.repaired).toBe(true);
      expect(r.data).toEqual({smart: true});
    }
  });

  it("returns failure for non-JSON", () => {
    const r = parseAiJson("not json at all");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.length).toBeGreaterThan(0);
      expect(r.raw).toBe("not json at all");
    }
  });
});

describe("normalizeLlmJsonTextForStructuredOutput", () => {
  it("returns JSON.stringify output on success", () => {
    expect(normalizeLlmJsonTextForStructuredOutput(`Yep: [1,2]`)).toBe("[1,2]");
  });

  it("returns fence-stripped text when parse fails", () => {
    expect(normalizeLlmJsonTextForStructuredOutput("```json\nbroken\n```")).toBe("broken");
  });
});
