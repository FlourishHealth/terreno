export const TRACKED_JSON_GIT_PATH = "scripts/track-upstream-expo/tracked.json";

export const ORIGIN_RELEASE_BRANCH_FETCH_REFSPEC =
  "refs/heads/release-*:refs/remotes/origin/release-*";

export const RELEASE_BRANCH_PATTERN = /^release-\d+\.\d+\.\d+$/;

export const assertReleaseBranchName = (releaseBranch: string): void => {
  if (!RELEASE_BRANCH_PATTERN.test(releaseBranch)) {
    throw new Error(`Invalid release branch: ${releaseBranch}`);
  }
};

export const originFetchCommand = (): string[] => {
  return ["git", "fetch", "--no-tags", "origin", ORIGIN_RELEASE_BRANCH_FETCH_REFSPEC];
};

export const originTrackedShowSpec = (releaseBranch: string): string => {
  assertReleaseBranchName(releaseBranch);
  return `origin/${releaseBranch}:${TRACKED_JSON_GIT_PATH}`;
};
