import {existsSync, readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {getDocsRoot} from "./docsRoot.js";

const semverKey = (v: string): number[] => {
  const core = v.split("-")[0] ?? v;
  return core.split(".").map((p) => Number.parseInt(p, 10) || 0);
};

const compareSemver = (a: string, b: string): number => {
  const pa = semverKey(a);
  const pb = semverKey(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) {
      return da < db ? -1 : 1;
    }
  }
  return 0;
};

export const getUpgradeGuideMarkdown = (fromVersion: string, toVersion: string): string => {
  const dir = join(getDocsRoot(), "upgrades");
  if (!existsSync(dir)) {
    return `_(No bundled upgrade notes under ${dir}.)_`;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const allVersions = files.map((f) => f.replace(/\.md$/i, ""));
  let versions: string[];
  if (fromVersion === toVersion) {
    versions = allVersions.includes(toVersion) ? [toVersion] : [];
  } else {
    versions = allVersions
      .filter((v) => compareSemver(v, fromVersion) > 0 && compareSemver(v, toVersion) <= 0)
      .sort(compareSemver);
  }

  if (versions.length === 0) {
    return `No upgrade notes found for range ${fromVersion} → ${toVersion} under bundled docs/upgrades.`;
  }

  const parts: string[] = [];
  for (const v of versions) {
    const text = readFileSync(join(dir, `${v}.md`), "utf-8");
    parts.push(`# Upgrade to ${v}\n\n${text.trim()}\n`);
  }
  return parts.join("\n---\n\n");
};
