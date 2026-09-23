import {existsSync, readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {getDocsRoot} from "./docsRoot.js";

const VERSION_CORE_PATTERN = /^\d+\.\d+\.\d+/;

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

const isVersionToken = (value: string): boolean => {
  return VERSION_CORE_PATTERN.test(value);
};

const listMinorFloorsInRange = (fromVersion: string, toVersion: string): string[] => {
  if (fromVersion === toVersion) {
    return [toVersion];
  }
  const fromKey = semverKey(fromVersion);
  const toKey = semverKey(toVersion);
  const fromMajor = fromKey[0] ?? 0;
  const toMajor = toKey[0] ?? 0;
  if (fromMajor !== toMajor) {
    return [];
  }
  const fromMinor = fromKey[1] ?? 0;
  const toMinor = toKey[1] ?? 0;
  const floors: string[] = [];
  for (let minor = fromMinor + 1; minor <= toMinor; minor += 1) {
    floors.push(`${fromMajor}.${minor}.0`);
  }
  return floors;
};

const formatRecordedNotes = (versions: string[]): string => {
  if (versions.length === 0) {
    return "none";
  }
  return versions.join(", ");
};

const coverageHeader = ({
  fromVersion,
  missingVersions,
  recordedVersions,
  toVersion,
}: {
  fromVersion: string;
  missingVersions: string[];
  recordedVersions: string[];
  toVersion: string;
}): string => {
  const recordedLine = `Recorded notes in ${fromVersion} → ${toVersion}: ${formatRecordedNotes(recordedVersions)}`;
  if (missingVersions.length === 0) {
    return recordedLine;
  }
  return [
    recordedLine,
    `No bundled notes for ${missingVersions.join(", ")}.`,
    "Do not conclude that nothing changed — absence of a note is not a no-op.",
  ].join("\n");
};

export const getUpgradeGuideMarkdown = (fromVersion: string, toVersion: string): string => {
  if (!isVersionToken(fromVersion) || !isVersionToken(toVersion)) {
    return `Invalid version range: \`fromVersion\` and \`toVersion\` must be semver strings such as 0.21.0.`;
  }
  if (compareSemver(fromVersion, toVersion) > 0) {
    return `Invalid version range: fromVersion (${fromVersion}) is greater than toVersion (${toVersion}).`;
  }

  const dir = join(getDocsRoot(), "upgrades");
  if (!existsSync(dir)) {
    return `_(No bundled upgrade notes under ${dir}.)_`;
  }
  const files = readdirSync(dir).filter((f) => /^\d.*\.md$/i.test(f));
  const allVersions = files.map((f) => f.replace(/\.md$/i, ""));
  let recordedVersions: string[];
  if (fromVersion === toVersion) {
    recordedVersions = allVersions.includes(toVersion) ? [toVersion] : [];
  } else {
    recordedVersions = allVersions
      .filter((v) => compareSemver(v, fromVersion) > 0 && compareSemver(v, toVersion) <= 0)
      .sort(compareSemver);
  }

  const expectedFloors = listMinorFloorsInRange(fromVersion, toVersion);
  const recordedSet = new Set(recordedVersions);
  const missingVersions = expectedFloors.filter((v) => !recordedSet.has(v));
  const header = coverageHeader({
    fromVersion,
    missingVersions,
    recordedVersions,
    toVersion,
  });

  if (recordedVersions.length === 0) {
    return `No upgrade notes recorded for ${fromVersion} → ${toVersion}.\n${header}`;
  }

  const parts: string[] = [header];
  for (const v of recordedVersions) {
    const text = readFileSync(join(dir, `${v}.md`), "utf-8");
    parts.push(`# Upgrade to ${v}\n\n${text.trim()}\n`);
  }
  return parts.join("\n\n---\n\n");
};
