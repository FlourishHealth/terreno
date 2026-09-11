/** Stable git branch for the daily update-dependencies run. Never invent a second. */
export const UPDATE_DEPENDENCIES_BRANCH = "chore/update-dependencies";

const UPDATE_DEPENDENCIES_BASE_BRANCH = "master";

/** Hidden marker in the rolling PR body so later runs find the same PR. */
export const UPDATE_DEPENDENCIES_PR_MARKER = "<!-- terreno-update-dependencies -->";

interface RollingPrCandidate {
  baseRefName: string;
  headRefName: string;
  headRepositoryName: string;
  headRepositoryOwnerLogin: string;
  isCrossRepository: boolean;
}

interface RepositoryIdentity {
  name: string;
  ownerLogin: string;
}

/**
 * A PR body, title, or fork branch is untrusted input. Only the canonical branch
 * in the base repository can control the scheduled dependency updater.
 */
export const isTrustedRollingPr = (
  candidate: RollingPrCandidate,
  repository: RepositoryIdentity
): boolean => {
  if (candidate.isCrossRepository) {
    return false;
  }
  return (
    candidate.baseRefName === UPDATE_DEPENDENCIES_BASE_BRANCH &&
    candidate.headRefName === UPDATE_DEPENDENCIES_BRANCH &&
    candidate.headRepositoryName === repository.name &&
    candidate.headRepositoryOwnerLogin === repository.ownerLogin
  );
};
