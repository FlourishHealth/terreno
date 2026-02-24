import {describe, expect, it} from "bun:test";

import {defaultPasswordRequirements, simplePasswordRequirements} from "./passwordPresets";

describe("defaultPasswordRequirements", () => {
  it("has 5 requirements", () => {
    expect(defaultPasswordRequirements).toHaveLength(5);
  });

  it("validates minimum length of 8 characters", () => {
    const req = defaultPasswordRequirements.find((r) => r.key === "minLength")!;
    expect(req.validate("short")).toBe(false);
    expect(req.validate("longenough")).toBe(true);
  });

  it("validates uppercase letter", () => {
    const req = defaultPasswordRequirements.find((r) => r.key === "uppercase")!;
    expect(req.validate("lowercase")).toBe(false);
    expect(req.validate("Uppercase")).toBe(true);
  });

  it("validates lowercase letter", () => {
    const req = defaultPasswordRequirements.find((r) => r.key === "lowercase")!;
    expect(req.validate("UPPERCASE")).toBe(false);
    expect(req.validate("lowercase")).toBe(true);
  });

  it("validates number", () => {
    const req = defaultPasswordRequirements.find((r) => r.key === "number")!;
    expect(req.validate("noDigits")).toBe(false);
    expect(req.validate("has1digit")).toBe(true);
  });

  it("validates special character", () => {
    const req = defaultPasswordRequirements.find((r) => r.key === "special")!;
    expect(req.validate("noSpecial1")).toBe(false);
    expect(req.validate("special!")).toBe(true);
  });

  it("passes all requirements for a strong password", () => {
    const strongPassword = "MyP@ssw0rd!";
    const allMet = defaultPasswordRequirements.every((r) => r.validate(strongPassword));
    expect(allMet).toBe(true);
  });
});

describe("simplePasswordRequirements", () => {
  it("has 1 requirement", () => {
    expect(simplePasswordRequirements).toHaveLength(1);
  });

  it("validates minimum length of 6 characters", () => {
    const req = simplePasswordRequirements[0];
    expect(req.validate("short")).toBe(false);
    expect(req.validate("enough")).toBe(true);
  });
});
