/** Stable git branch for the daily update-dependencies run. Never invent a second. */
export const UPDATE_DEPENDENCIES_BRANCH = "chore/update-dependencies";

/** Hidden marker in the rolling PR body so later runs find the same PR. */
export const UPDATE_DEPENDENCIES_PR_MARKER = "<!-- terreno-update-dependencies -->";

export const UPDATE_DEPENDENCIES_PR_TITLE = "chore(deps): daily dependency updates";
