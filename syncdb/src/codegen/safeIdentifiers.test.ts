import {describe, expect, it} from "bun:test";

import {assertTsIdentifier, emitTsPropertyKey, emitTsString} from "./safeIdentifiers";

describe("assertTsIdentifier", () => {
  it("accepts TypeScript identifiers", () => {
    expect(assertTsIdentifier({label: "name", value: "Todo"})).toBe("Todo");
    expect(assertTsIdentifier({label: "name", value: "_id"})).toBe("_id");
  });

  it("rejects quote and statement injection", () => {
    expect(() =>
      assertTsIdentifier({label: "collection", value: 'todos"; process.exit(1); //'})
    ).toThrow(/not a TypeScript identifier/);
  });
});

describe("emitTsString", () => {
  it("JSON-escapes quotes so they cannot close a generated string", () => {
    expect(emitTsString('todos"; process.exit(1); //')).toBe('"todos\\"; process.exit(1); //"');
  });
});

describe("emitTsPropertyKey", () => {
  it("emits bare identifiers", () => {
    expect(emitTsPropertyKey("title")).toBe("title");
  });

  it("quotes keys that are not identifiers", () => {
    expect(emitTsPropertyKey('foo"; bar')).toBe('"foo\\"; bar"');
  });
});
