import {afterEach, describe, expect, it} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {resolveFirstWorkspaceDir, resolveTerrenoProjectRoot} from "../local/projectRoot.js";

const dirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "terreno-root-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  Reflect.deleteProperty(process.env, "TERRENO_PROJECT_ROOT");
  for (const dir of dirs.splice(0)) {
    rmSync(dir, {force: true, recursive: true});
  }
});

describe("resolveTerrenoProjectRoot", () => {
  it("returns TERRENO_PROJECT_ROOT when set", () => {
    const override = makeTempDir();
    process.env.TERRENO_PROJECT_ROOT = ` ${override} `;
    expect(resolveTerrenoProjectRoot("/tmp/does-not-exist")).toBe(override);
  });

  it("finds a backend+frontend layout", () => {
    const root = makeTempDir();
    writeFileSync(join(root, "package.json"), JSON.stringify({name: "app"}));
    mkdirSync(join(root, "backend"));
    writeFileSync(join(root, "backend", "package.json"), JSON.stringify({name: "backend"}));
    mkdirSync(join(root, "frontend"));
    writeFileSync(join(root, "frontend", "package.json"), JSON.stringify({name: "frontend"}));
    const nested = join(root, "frontend", "src");
    mkdirSync(nested, {recursive: true});
    expect(resolveTerrenoProjectRoot(nested)).toBe(root);
  });

  it("treats a workspace root with backend or frontend as the layout root", () => {
    const root = makeTempDir();
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({name: "mono", workspaces: ["backend"]})
    );
    mkdirSync(join(root, "backend"));
    writeFileSync(join(root, "backend", "package.json"), JSON.stringify({name: "backend"}));
    expect(resolveTerrenoProjectRoot(root)).toBe(root);
  });

  it("skips unreadable package.json and falls back to startDir", () => {
    const root = makeTempDir();
    writeFileSync(join(root, "package.json"), "{not-json");
    expect(resolveTerrenoProjectRoot(root)).toBe(root);
  });

  it("treats example-backend + example-frontend as a layout root", () => {
    const root = makeTempDir();
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({name: "mono", workspaces: ["example-backend"]})
    );
    mkdirSync(join(root, "example-backend"));
    writeFileSync(join(root, "example-backend", "package.json"), JSON.stringify({name: "be"}));
    mkdirSync(join(root, "example-frontend"));
    writeFileSync(join(root, "example-frontend", "package.json"), JSON.stringify({name: "fe"}));
    const nested = join(root, "example-backend", "src");
    mkdirSync(nested, {recursive: true});
    expect(resolveTerrenoProjectRoot(nested)).toBe(root);
  });
});

describe("resolveFirstWorkspaceDir", () => {
  it("prefers the bootstrap name over the example-app name", () => {
    const root = makeTempDir();
    mkdirSync(join(root, "backend"));
    writeFileSync(join(root, "backend", "package.json"), JSON.stringify({name: "be"}));
    mkdirSync(join(root, "example-backend"));
    writeFileSync(join(root, "example-backend", "package.json"), JSON.stringify({name: "ex"}));
    expect(resolveFirstWorkspaceDir(root, ["backend", "example-backend"])).toBe("backend");
  });

  it("falls back to the example-app name when the bootstrap dir is absent", () => {
    const root = makeTempDir();
    mkdirSync(join(root, "example-frontend"));
    writeFileSync(join(root, "example-frontend", "package.json"), JSON.stringify({name: "fe"}));
    expect(resolveFirstWorkspaceDir(root, ["frontend", "example-frontend"])).toBe(
      "example-frontend"
    );
  });

  it("returns undefined when no candidate has a package.json", () => {
    const root = makeTempDir();
    expect(resolveFirstWorkspaceDir(root, ["frontend", "example-frontend"])).toBeUndefined();
  });
});
