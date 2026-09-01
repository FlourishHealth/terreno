import {existsSync, readdirSync} from "node:fs";
import {join} from "node:path";

export interface ResolveDocVersionInput {
  requested?: string;
  retained: string[];
}

export interface ResolvedDocVersion {
  version: string;
  note?: string;
}

const isSemverLike = (value: string): boolean => /^\d+\.\d+\.\d+/.test(value);

const stripVersionRangePrefix = (value: string): string => {
  const trimmed = value.trim();
  const withoutOperator = trimmed.replace(/^(?:workspace:)?[~^>=<\s]+/, "");
  const firstToken = withoutOperator.split(/\s+/)[0] ?? withoutOperator;
  return firstToken.replace(/^[~^>=<]+/, "");
};

const semverKey = (value: string): number[] => {
  const core = value.split("-")[0] ?? value;
  return core.split(".").map((part) => Number.parseInt(part, 10) || 0);
};

export const compareDocSemver = (left: string, right: string): number => {
  const leftParts = semverKey(left);
  const rightParts = semverKey(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const deltaLeft = leftParts[index] ?? 0;
    const deltaRight = rightParts[index] ?? 0;
    if (deltaLeft !== deltaRight) {
      return deltaLeft < deltaRight ? -1 : 1;
    }
  }
  return 0;
};

const latestSemver = (versions: string[]): string | undefined => {
  const sorted = versions.filter(isSemverLike).sort(compareDocSemver);
  return sorted[sorted.length - 1];
};

const fallbackVersion = (retained: string[]): string => {
  if (retained.includes("next")) {
    return "next";
  }
  return latestSemver(retained) ?? retained[0] ?? "next";
};

export const resolveDocVersion = ({
  requested,
  retained,
}: ResolveDocVersionInput): ResolvedDocVersion => {
  const versions = retained.length > 0 ? retained : ["next"];
  const trimmed = stripVersionRangePrefix(requested?.trim() ?? "");
  if (trimmed === "" || trimmed === "next") {
    return {version: fallbackVersion(versions)};
  }
  if (versions.includes(trimmed)) {
    return {version: trimmed};
  }
  if (!isSemverLike(trimmed)) {
    const version = fallbackVersion(versions);
    return {
      note: `Requested docs version "${trimmed}" is not a retained snapshot; using ${version}.`,
      version,
    };
  }
  const semverRetained = versions.filter(isSemverLike).sort(compareDocSemver);
  const notNewer = [...semverRetained]
    .reverse()
    .find((candidate) => compareDocSemver(candidate, trimmed) <= 0);
  const version = notNewer ?? semverRetained[0] ?? fallbackVersion(versions);
  return {
    note: `Requested docs version "${trimmed}" is not retained; using nearest snapshot ${version}.`,
    version,
  };
};

export const listRetainedDocVersions = (docsRoot: string): string[] => {
  const versionedDir = join(docsRoot, "versioned");
  if (!existsSync(versionedDir)) {
    return ["next"];
  }
  return readdirSync(versionedDir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name);
};

export const docVersionFromSourcePath = (sourcePath: string): string | undefined => {
  const normalized = sourcePath.replace(/\\/g, "/");
  const match = normalized.match(/(?:^|\/)versioned\/([^/]+)\//);
  return match?.[1];
};

export const slugifyComponentName = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
