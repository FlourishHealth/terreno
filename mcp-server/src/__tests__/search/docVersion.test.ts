import {describe, expect, test} from "bun:test";
import {mkdirSync, rmSync, writeFileSync} from "node:fs";
import {join} from "node:path";

import {
  generatorSlugifyComponentName,
  listRetainedDocVersions,
  resolveDocVersion,
  slugifyComponentName,
  snapshotComponentFileBases,
} from "../../search/docVersion.js";

describe("resolveDocVersion", () => {
  test("omitted or blank version resolves to next", () => {
    expect(resolveDocVersion({retained: ["0.19.0", "next"]}).version).toBe("next");
    expect(resolveDocVersion({requested: "  ", retained: ["0.19.0", "next"]}).version).toBe("next");
    expect(
      resolveDocVersion({requested: "next", retained: ["0.19.0", "next"]}).note
    ).toBeUndefined();
  });

  test("exact retained version matches", () => {
    const resolved = resolveDocVersion({
      requested: "0.19.0",
      retained: ["0.19.0", "0.20.0", "next"],
    });
    expect(resolved.version).toBe("0.19.0");
    expect(resolved.note).toBeUndefined();
  });

  test("unmatched patch falls back to highest retained version that is less or equal", () => {
    const resolved = resolveDocVersion({
      requested: "0.19.1",
      retained: ["0.18.0", "0.19.0", "0.20.0", "next"],
    });
    expect(resolved.version).toBe("0.19.0");
    expect(resolved.note).toContain("0.19.1");
    expect(resolved.note).toContain("0.19.0");
  });

  test("version older than every snapshot falls back to the oldest retained semver", () => {
    const resolved = resolveDocVersion({
      requested: "0.1.0",
      retained: ["0.19.0", "0.20.0", "next"],
    });
    expect(resolved.version).toBe("0.19.0");
    expect(resolved.note).toContain("0.1.0");
  });

  test("unknown token falls back to next", () => {
    const resolved = resolveDocVersion({requested: "not-a-version", retained: ["0.19.0", "next"]});
    expect(resolved.version).toBe("next");
    expect(resolved.note).toContain("not-a-version");
  });

  test("strips package.json range prefixes before matching", () => {
    const caret = resolveDocVersion({
      requested: "^0.19.0",
      retained: ["0.19.0", "0.20.0", "next"],
    });
    expect(caret.version).toBe("0.19.0");
    expect(caret.note).toBeUndefined();

    const tilde = resolveDocVersion({
      requested: "~0.19.1",
      retained: ["0.19.0", "0.20.0", "next"],
    });
    expect(tilde.version).toBe("0.19.0");
    expect(tilde.note).toContain("0.19.1");
  });
});

describe("snapshotComponentFileBases", () => {
  test("includes hyphenated camelCase and concatenated generator slugs", () => {
    expect(slugifyComponentName("UserInactivity")).toBe("user-inactivity");
    expect(generatorSlugifyComponentName("UserInactivity")).toBe("userinactivity");
    expect(snapshotComponentFileBases("UserInactivity")).toEqual([
      "user-inactivity",
      "userinactivity",
    ]);
    expect(snapshotComponentFileBases("Text field")).toEqual(["text-field"]);
  });
});

describe("listRetainedDocVersions", () => {
  test("lists versioned subdirectories", () => {
    const tmp = `${import.meta.dir}/tmp-doc-versions`;
    rmSync(tmp, {force: true, recursive: true});
    mkdirSync(join(tmp, "versioned", "0.19.0"), {recursive: true});
    mkdirSync(join(tmp, "versioned", "next"), {recursive: true});
    writeFileSync(join(tmp, "versioned", "0.19.0", "keep.txt"), "x");
    expect(listRetainedDocVersions(tmp).sort()).toEqual(["0.19.0", "next"]);
    rmSync(tmp, {force: true, recursive: true});
  });
});
