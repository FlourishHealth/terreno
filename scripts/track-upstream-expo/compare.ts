export const LOOP_STATUSES = ["blocked", "idle", "open", "ready"] as const;

export type LoopStatus = (typeof LOOP_STATUSES)[number];

export interface TrackedState {
  expoVersion: string;
  loopStatus: LoopStatus;
  npmTag: "canary" | "latest" | "next";
  releaseBranch: string | null;
  sdkLine: string;
  updatedAt: string;
}

export interface ParsedExpoVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<number | string>;
}

export interface ProbeInput {
  branchTracked: TrackedState | null;
  existingReleaseBranches: string[];
  masterCatalogExpo: string;
  npmTags: Record<string, string>;
  tracked: TrackedState;
}

export interface ProbeResult {
  action: "continue-branch" | "create-branch" | "none" | "resume-loop";
  expoVersion: string | null;
  loopStatus: LoopStatus | null;
  npmTag: string | null;
  reason: string;
  releaseBranch: string | null;
  sdkLine: string | null;
}

export const stripVersionRange = (raw: string): string => {
  return raw.trim().replace(/^[~^]/, "");
};

export const parseExpoVersion = (raw: string): ParsedExpoVersion => {
  const stripped = stripVersionRange(raw);
  const match = stripped.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid expo version: ${raw}`);
  }
  const prerelease = match[4]
    ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
};

const comparePrereleaseIdentifiers = (left: number | string, right: number | string): number => {
  const leftIsNumber = typeof left === "number";
  const rightIsNumber = typeof right === "number";
  if (leftIsNumber && rightIsNumber) {
    return left - right;
  }
  if (leftIsNumber) {
    return -1;
  }
  if (rightIsNumber) {
    return 1;
  }
  return String(left).localeCompare(String(right));
};

export const compareExpoVersions = (leftRaw: string, rightRaw: string): number => {
  const left = parseExpoVersion(leftRaw);
  const right = parseExpoVersion(rightRaw);
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  if (left.patch !== right.patch) {
    return left.patch - right.patch;
  }
  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0;
  }
  if (left.prerelease.length === 0) {
    return 1;
  }
  if (right.prerelease.length === 0) {
    return -1;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (index >= left.prerelease.length) {
      return -1;
    }
    if (index >= right.prerelease.length) {
      return 1;
    }
    const compared = comparePrereleaseIdentifiers(left.prerelease[index], right.prerelease[index]);
    if (compared !== 0) {
      return compared;
    }
  }
  return 0;
};

export const sdkLineFromExpoVersion = (raw: string): string => {
  const parsed = parseExpoVersion(raw);
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
};

export const releaseBranchFromSdkLine = (sdkLine: string): string => {
  return `release-${sdkLine}`;
};

export const maxExpoVersion = (versions: string[]): string => {
  if (versions.length === 0) {
    throw new Error("maxExpoVersion requires at least one version");
  }
  return versions.reduce((highest, current) =>
    compareExpoVersions(current, highest) > 0 ? current : highest
  );
};

const CANDIDATE_TAGS = ["next", "latest"] as const;

export const pickUpstreamCandidate = ({
  masterCatalogExpo,
  npmTags,
}: {
  masterCatalogExpo: string;
  npmTags: Record<string, string>;
}): {npmTag: (typeof CANDIDATE_TAGS)[number]; version: string} | null => {
  const masterMajor = parseExpoVersion(masterCatalogExpo).major;
  const candidates: Array<{npmTag: (typeof CANDIDATE_TAGS)[number]; version: string}> = [];
  for (const npmTag of CANDIDATE_TAGS) {
    const version = npmTags[npmTag];
    if (!version) {
      continue;
    }
    if (parseExpoVersion(version).major <= masterMajor) {
      continue;
    }
    candidates.push({npmTag, version});
  }
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((highest, current) =>
    compareExpoVersions(current.version, highest.version) > 0 ? current : highest
  );
};

export const isResumableLoop = (loopStatus: LoopStatus | null | undefined): boolean => {
  return loopStatus === "blocked" || loopStatus === "open";
};

const noneResult = ({
  expoVersion,
  loopStatus,
  npmTag,
  reason,
  releaseBranch,
  sdkLine,
}: {
  expoVersion: string | null;
  loopStatus: LoopStatus | null;
  npmTag: string | null;
  reason: string;
  releaseBranch: string | null;
  sdkLine: string | null;
}): ProbeResult => {
  return {
    action: "none",
    expoVersion,
    loopStatus,
    npmTag,
    reason,
    releaseBranch,
    sdkLine,
  };
};

export const decideProbe = ({
  branchTracked,
  existingReleaseBranches,
  masterCatalogExpo,
  npmTags,
  tracked,
}: ProbeInput): ProbeResult => {
  const candidate = pickUpstreamCandidate({masterCatalogExpo, npmTags});
  const inFlight = branchTracked ?? (tracked.releaseBranch ? tracked : null);

  if (!candidate) {
    if (inFlight && isResumableLoop(inFlight.loopStatus) && inFlight.releaseBranch) {
      return {
        action: "resume-loop",
        expoVersion: inFlight.expoVersion,
        loopStatus: inFlight.loopStatus,
        npmTag: inFlight.npmTag,
        reason: `Resume ${inFlight.loopStatus} loop on ${inFlight.releaseBranch} at ${inFlight.expoVersion}`,
        releaseBranch: inFlight.releaseBranch,
        sdkLine: inFlight.sdkLine,
      };
    }
    return noneResult({
      expoVersion: null,
      loopStatus: tracked.loopStatus,
      npmTag: null,
      reason: `No Expo SDK major newer than catalog ${stripVersionRange(masterCatalogExpo)}`,
      releaseBranch: tracked.releaseBranch,
      sdkLine: tracked.sdkLine,
    });
  }

  const sdkLine = sdkLineFromExpoVersion(candidate.version);
  const releaseBranch = releaseBranchFromSdkLine(sdkLine);
  const knownVersions = [tracked.expoVersion, stripVersionRange(masterCatalogExpo)];
  if (branchTracked?.expoVersion) {
    knownVersions.push(branchTracked.expoVersion);
  }
  const effectiveTracked = maxExpoVersion(knownVersions);
  if (compareExpoVersions(candidate.version, effectiveTracked) <= 0) {
    const loopStatus = branchTracked?.loopStatus ?? tracked.loopStatus;
    if (isResumableLoop(loopStatus)) {
      return {
        action: "resume-loop",
        expoVersion: effectiveTracked,
        loopStatus,
        npmTag: candidate.npmTag,
        reason: `Resume ${loopStatus} loop on ${releaseBranch} at ${effectiveTracked}`,
        releaseBranch,
        sdkLine,
      };
    }
    return noneResult({
      expoVersion: candidate.version,
      loopStatus,
      npmTag: candidate.npmTag,
      reason: `Already tracking ${effectiveTracked} (candidate ${candidate.version}); loop ${loopStatus}`,
      releaseBranch,
      sdkLine,
    });
  }

  const branchExists = existingReleaseBranches.includes(releaseBranch);
  return {
    action: branchExists ? "continue-branch" : "create-branch",
    expoVersion: candidate.version,
    loopStatus: "open",
    npmTag: candidate.npmTag,
    reason: branchExists
      ? `Newer ${candidate.npmTag} ${candidate.version} on existing ${releaseBranch}`
      : `New SDK line ${sdkLine} (${candidate.version}); create ${releaseBranch}`,
    releaseBranch,
    sdkLine,
  };
};

export const nextTrackedState = ({
  expoVersion,
  loopStatus,
  npmTag,
  releaseBranch,
  sdkLine,
  updatedAt,
}: {
  expoVersion: string;
  loopStatus: LoopStatus;
  npmTag: TrackedState["npmTag"];
  releaseBranch: string;
  sdkLine: string;
  updatedAt: string;
}): TrackedState => {
  return {
    expoVersion,
    loopStatus,
    npmTag,
    releaseBranch,
    sdkLine,
    updatedAt,
  };
};
