import {describe, expect, it} from "bun:test";

import {createProcessIo, printError, printJson} from "./io";
import {parseFormField, parseModelField, parseNameValue} from "./parseFields";

describe("io helpers", () => {
  it("creates process io", () => {
    const io = createProcessIo();
    expect(typeof io.stdout).toBe("function");
    printJson(io, {ok: true});
    printError(io, "x");
  });
});

describe("parseFields errors", () => {
  it("rejects empty field names", () => {
    expect(() => parseModelField("")).toThrow("Invalid --field");
    expect(() => parseFormField("")).toThrow("Invalid --field");
    expect(() => parseNameValue("nope")).toThrow("name=value");
    expect(parseModelField("age:Number:default=1")).toEqual({
      default: "1",
      name: "age",
      type: "Number",
    });
  });
});
