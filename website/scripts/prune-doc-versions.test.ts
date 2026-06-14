import {describe, expect, it} from "bun:test";

const parseVersionLabel = (label: string): number[] =>
  label
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10));

const compareVersions = (a: string, b: string): number => {
  const aParts = parseVersionLabel(a);
  const bParts = parseVersionLabel(b);
  const length = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < length; index += 1) {
    const aValue = aParts[index] ?? 0;
    const bValue = bParts[index] ?? 0;
    if (aValue !== bValue) {
      return bValue - aValue;
    }
  }
  return 0;
};

describe("prune-doc-versions helpers", () => {
  it("sorts semver labels descending", () => {
    const sorted = ["0.15.0", "0.18.0", "0.17.2", "0.17.0"].sort(compareVersions);
    expect(sorted).toEqual(["0.18.0", "0.17.2", "0.17.0", "0.15.0"]);
  });
});
