import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  decideProbe,
  isResumableLoop,
  type ProbeResult,
  parseExpoVersion,
  pickUpstreamCandidate,
  releaseBranchFromSdkLine,
  sdkLineFromExpoVersion,
  stripVersionRange,
  type TrackedState,
} from "./compare.ts";
import {originFetchCommand, originTrackedShowSpec} from "./remoteTracked.ts";

const ROOT_DIRECTORY = resolve(import.meta.dir, "../..");
const TRACKED_PATH = resolve(import.meta.dir, "tracked.json");

interface NpmPackageVersionResponse {
  version?: string;
}

const readTrackedState = (): TrackedState => {
  return JSON.parse(readFileSync(TRACKED_PATH, "utf8")) as TrackedState;
};

const readMasterCatalogExpo = (): string => {
  const packageJson = JSON.parse(readFileSync(resolve(ROOT_DIRECTORY, "package.json"), "utf8")) as {
    catalog?: Record<string, string>;
  };
  const expo = packageJson.catalog?.expo;
  if (!expo) {
    throw new Error("Root package.json catalog is missing expo");
  }
  return stripVersionRange(expo);
};

const fetchNpmTagVersion = async (tag: string): Promise<string | null> => {
  const response = await fetch(`https://registry.npmjs.org/expo/${tag}`, {
    headers: {accept: "application/json"},
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`npm registry expo@${tag} failed: ${response.status}`);
  }
  const body = (await response.json()) as NpmPackageVersionResponse;
  return body.version ?? null;
};

const fetchNpmTags = async (): Promise<Record<string, string>> => {
  const tags: Record<string, string> = {};
  const next = await fetchNpmTagVersion("next");
  const latest = await fetchNpmTagVersion("latest");
  if (next) {
    tags.next = next;
  }
  if (latest) {
    tags.latest = latest;
  }
  return tags;
};

const listRemoteReleaseBranches = (): string[] => {
  const result = Bun.spawnSync(["git", "ls-remote", "--heads", "origin", "release-*"], {
    cwd: ROOT_DIRECTORY,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    throw new Error(`git ls-remote failed: ${stderr || result.exitCode}`);
  }
  return result.stdout
    .toString()
    .split("\n")
    .map((line) => {
      const match = line.match(/refs\/heads\/(release-\d+\.\d+\.\d+)$/);
      return match?.[1];
    })
    .filter((name): name is string => Boolean(name));
};

const fetchOriginReleaseBranches = (): void => {
  const result = Bun.spawnSync(originFetchCommand(), {
    cwd: ROOT_DIRECTORY,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    throw new Error(`git fetch release-* failed: ${stderr || result.exitCode}`);
  }
};

const readBranchTracked = (releaseBranch: string): TrackedState | null => {
  let showSpec: string;
  try {
    showSpec = originTrackedShowSpec(releaseBranch);
  } catch {
    return null;
  }
  const result = Bun.spawnSync(["git", "show", showSpec], {
    cwd: ROOT_DIRECTORY,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) {
    return null;
  }
  try {
    return JSON.parse(result.stdout.toString()) as TrackedState;
  } catch {
    return null;
  }
};

const findBranchTracked = ({
  candidateBranch,
  existingReleaseBranches,
  masterCatalogExpo,
  tracked,
}: {
  candidateBranch: string | null;
  existingReleaseBranches: string[];
  masterCatalogExpo: string;
  tracked: TrackedState;
}): TrackedState | null => {
  if (candidateBranch) {
    const fromCandidate = readBranchTracked(candidateBranch);
    if (fromCandidate) {
      return fromCandidate;
    }
  }
  if (tracked.releaseBranch) {
    const fromTracked = readBranchTracked(tracked.releaseBranch);
    if (fromTracked) {
      return fromTracked;
    }
  }
  const masterMajor = parseExpoVersion(masterCatalogExpo).major;
  for (const releaseBranch of [...existingReleaseBranches].sort().reverse()) {
    const remote = readBranchTracked(releaseBranch);
    if (!remote) {
      continue;
    }
    if (parseExpoVersion(remote.sdkLine || remote.expoVersion).major <= masterMajor) {
      continue;
    }
    if (isResumableLoop(remote.loopStatus)) {
      return remote;
    }
  }
  return null;
};

export const runProbe = async (): Promise<{exitCode: number; result: ProbeResult}> => {
  const tracked = readTrackedState();
  const masterCatalogExpo = readMasterCatalogExpo();
  const npmTags = await fetchNpmTags();
  const existingReleaseBranches = listRemoteReleaseBranches();
  if (existingReleaseBranches.length > 0) {
    fetchOriginReleaseBranches();
  }
  const candidate = pickUpstreamCandidate({masterCatalogExpo, npmTags});
  const candidateBranch = candidate
    ? releaseBranchFromSdkLine(sdkLineFromExpoVersion(candidate.version))
    : null;
  const branchTracked = findBranchTracked({
    candidateBranch,
    existingReleaseBranches,
    masterCatalogExpo,
    tracked,
  });
  const result = decideProbe({
    branchTracked,
    existingReleaseBranches,
    masterCatalogExpo,
    npmTags,
    tracked,
  });
  const exitCode = result.action === "none" ? 1 : 0;
  return {exitCode, result};
};

const main = async (): Promise<void> => {
  try {
    const {exitCode, result} = await runProbe();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(2);
  }
};

if (import.meta.main) {
  await main();
}
