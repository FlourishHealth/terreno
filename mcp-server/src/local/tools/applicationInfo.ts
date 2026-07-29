import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {resolveTerrenoProjectRoot} from "../projectRoot.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  version?: string;
}

const readJson = (path: string): PackageJson | null => {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PackageJson;
  } catch {
    return null;
  }
};

const collectTerrenoVersions = (pkg: PackageJson | null): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!pkg) {
    return out;
  }
  const merge = (deps?: Record<string, string>) => {
    if (!deps) {
      return;
    }
    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith("@terreno/")) {
        out[name] = version;
      }
    }
  };
  merge(pkg.dependencies);
  merge(pkg.devDependencies);
  return out;
};

/**
 * Parses root `package.json` and `bun.lock` workspace entries for key dependency versions.
 * Call at the start of a session so the agent can write version-correct code (Boost pattern).
 */
export const applicationInfo = (): string => {
  const root = resolveTerrenoProjectRoot();
  const rootPkg = readJson(join(root, "package.json"));
  const lockPath = join(root, "bun.lock");
  const lockExists = existsSync(lockPath);

  const backendPkg = readJson(join(root, "backend", "package.json"));
  const frontendPkg = readJson(join(root, "frontend", "package.json"));

  const lines: string[] = [];
  lines.push(`# Application info`);
  lines.push("");
  lines.push(`- **projectRoot**: \`${root}\``);
  lines.push(`- **root package**: ${rootPkg?.name ?? "(none)"} @ ${rootPkg?.version ?? "?"}`);
  lines.push(`- **bun.lock present**: ${lockExists ? "yes" : "no"}`);
  lines.push("");

  const terrenoRoot = collectTerrenoVersions(rootPkg);
  if (Object.keys(terrenoRoot).length > 0) {
    lines.push("## @terreno/* (root package.json)");
    for (const [k, v] of Object.entries(terrenoRoot)) {
      lines.push(`- ${k}: ${v}`);
    }
    lines.push("");
  }

  const pick = (label: string, pkg: PackageJson | null) => {
    if (!pkg) {
      return;
    }
    lines.push(`## ${label}`);
    lines.push(`- **name**: ${pkg.name ?? "?"}`);
    lines.push(`- **version**: ${pkg.version ?? "?"}`);
    const t = collectTerrenoVersions(pkg);
    for (const [k, v] of Object.entries(t)) {
      lines.push(`- ${k}: ${v}`);
    }
    const keys = ["expo", "react", "react-native", "mongoose", "bun", "@types/bun"] as const;
    for (const key of keys) {
      const v =
        pkg.dependencies?.[key] ??
        pkg.devDependencies?.[key] ??
        pkg.dependencies?.[`${key}` as keyof typeof pkg.dependencies];
      if (v) {
        lines.push(`- **${key}**: ${v}`);
      }
    }
    lines.push("");
  };

  pick("Backend workspace", backendPkg);
  pick("Frontend workspace", frontendPkg);

  if (lockExists) {
    lines.push("## Lockfile");
    lines.push(
      "Workspace package versions are recorded under `workspaces` in `bun.lock`. Prefer installed semver over `latest` in generated code."
    );
  }

  return lines.join("\n");
};
