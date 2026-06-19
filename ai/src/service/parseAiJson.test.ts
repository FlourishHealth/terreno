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

  it("returns failure for empty string", () => {
    const r = parseAiJson("");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe("Empty or non-string input");
    }
  });

  it("returns failure for whitespace-only string", () => {
    const r = parseAiJson("   ");
    expect(r.success).toBe(false);
  });

  it("handles escaped characters inside JSON strings during balanced extraction", () => {
    const r = parseAiJson(`noise {"key": "val\\"ue"} tail`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({key: 'val"ue'});
    }
  });

  it("handles backslash escapes in balanced JSON extraction", () => {
    const r = parseAiJson(`prefix {"path": "C:\\\\Users\\\\test"} suffix`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({path: "C:\\Users\\test"});
    }
  });

  it("returns failure for mismatched brackets", () => {
    const r = parseAiJson("{]");
    expect(r.success).toBe(false);
  });

  it("repairs trailing commas inside balanced extraction with backslash content", () => {
    const input = `here {"a": "x\\\\y", "b": 1,}`;
    const r = parseAiJson(input);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.repaired).toBe(true);
      expect(r.data).toEqual({a: "x\\y", b: 1});
    }
  });

  it("repairs smart quotes via whole-string repair when balanced extraction fails", () => {
    const r = parseAiJson(`{\u201Ckey\u201D: \u201Cvalue\u201D}`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.repaired).toBe(true);
      expect(r.data).toEqual({key: "value"});
    }
  });

  it("strips partial opening fence without full closure", () => {
    const r = parseAiJson('```json\n{"a":1}');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({a: 1});
    }
  });

  it("handles arrays as top-level JSON", () => {
    const r = parseAiJson("here is the list: [1, 2, 3] enjoy");
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual([1, 2, 3]);
    }
  });

  it("returns failure when no opening bracket exists", () => {
    const r = parseAiJson("no brackets at all just text");
    expect(r.success).toBe(false);
  });

  it("returns failure for unterminated JSON", () => {
    const r = parseAiJson('{"a": 1');
    expect(r.success).toBe(false);
  });

  it("repairs smart quotes inside a balanced extraction (repairedSlice path)", () => {
    const r = parseAiJson(`prefix {\u201Ckey\u201D: 1} suffix`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.repaired).toBe(true);
      expect(r.data).toEqual({key: 1});
    }
  });

  it("repairs whole cleaned text when balanced extraction is not possible", () => {
    const r = parseAiJson(`\u201Chello\u201D`);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.repaired).toBe(true);
      expect(r.data).toBe("hello");
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
