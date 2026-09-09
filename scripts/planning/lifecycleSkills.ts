import {existsSync, readFileSync, readdirSync} from "node:fs";
import {join} from "node:path";

export const LIFECYCLE_STAGES = ["grow", "pick", "roast", "brew", "taste"] as const;
export const RESULT_STATUSES = ["PASS", "FAIL", "BLOCKED", "PENDING"] as const;

interface StageDefinition {
  directory: string;
  nextMarkers: string[];
  stage: (typeof LIFECYCLE_STAGES)[number];
}

interface ValidateLifecyclePluginOptions {
  rootDirectory: string;
}

interface ValidateStageContentOptions {
  content: string;
  definition: StageDefinition;
}

interface TextFile {
  content: string;
  path: string;
}

const PR_HEADINGS = ["## Why", "## What changed", "## Verification"];
const PR_FORBIDDEN_HEADINGS = [
  "## Summary",
  "## Related IP or issue",
  "## Type of change",
  "## Testing performed",
  "## Checklist",
];

const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    directory: "terreno-1-grow",
    nextMarkers: [
      "next: pick",
      "next: grow",
      "next: null",
    ],
    stage: "grow",
  },
  {
    directory: "terreno-2-pick",
    nextMarkers: [
      "next: roast",
      "next: pick",
      "next: brew",
      "next: null",
    ],
    stage: "pick",
  },
  {
    directory: "terreno-3-roast",
    nextMarkers: [
      "next: brew",
      "next: pick",
      "next: null",
    ],
    stage: "roast",
  },
  {
    directory: "terreno-4-brew",
    nextMarkers: [
      "next: taste",
      "next: pick",
      "next: roast",
      "next: brew",
      "next: null",
    ],
    stage: "brew",
  },
  {
    directory: "terreno-5-taste",
    nextMarkers: ["next: taste", "next: null"],
    stage: "taste",
  },
];

const OUTER_LOOP_DIRECTORIES = ["terreno-planning-loop", "terreno-taste-sweep"] as const;

const REQUIRED_SECTIONS = [
  "## Preconditions",
  "## Inputs",
  "## Procedure",
  "## Supporting skills",
  "## Evidence produced",
  "## Success conditions",
  "## Failure conditions",
  "## Blocked conditions",
  "## Recommended next stage",
];

const RETIRED_IDENTIFIERS = [
  "terreno-1-blend",
  "terreno-2-roast",
  "terreno-3-cupping",
  "terreno-4-pour",
  "terreno-5-dialin",
];

const TASTE_UNBOUNDED_LOOP_PATTERNS = [
  /keep the loop active/i,
  /continue the loop/i,
  /do not exit until all checks pass/i,
  /wait until all CI is green/i,
];

const PORTABILITY_MARKERS = [
  "@terreno/",
  "example-frontend",
  "admin-frontend",
  "bun run",
  "MongoMemoryServer",
  "docs/implementationPlans",
];

const readMarkdownFiles = (directory: string): TextFile[] => {
  const files: TextFile[] = [];

  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...readMarkdownFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push({content: readFileSync(path, "utf8"), path});
    }
  }

  return files;
};

export const validateStageContent = ({
  content,
  definition,
}: ValidateStageContentOptions): string[] => {
  const errors: string[] = [];
  const prefix = definition.directory;

  if (!content.includes(`name: ${definition.directory}`)) {
    errors.push(`${prefix}: frontmatter name must match its canonical directory`);
  }

  if (!content.includes("disable-model-invocation: true")) {
    errors.push(`${prefix}: lifecycle skills must be explicitly invoked`);
  }

  if (!content.includes("../../references/lifecycle-contract.md")) {
    errors.push(`${prefix}: must load the shared lifecycle contract`);
  }

  if (!content.includes("../../references/documentation-contract.md")) {
    errors.push(`${prefix}: must load the shared documentation contract`);
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`${prefix}: missing section ${section}`);
    }
  }

  for (const marker of definition.nextMarkers) {
    if (!content.includes(marker)) {
      errors.push(`${prefix}: missing transition marker ${marker}`);
    }
  }

  for (const marker of PORTABILITY_MARKERS) {
    if (content.includes(marker)) {
      errors.push(
        `${prefix}: repository-specific marker belongs in a project skill: ${marker}`
      );
    }
  }

  if (definition.stage === "grow") {
    if (!content.includes("references/grilling.md")) {
      errors.push(`${prefix}: Grow must load the grilling procedure`);
    }
    if (!content.includes("Decisions table")) {
      errors.push(`${prefix}: Grow must list grilled decisions in a Decisions table`);
    }
  }

  if (definition.stage === "pick" || definition.stage === "roast") {
    if (!content.includes("../../references/pick-roast-loop.md")) {
      errors.push(`${prefix}: must load the pick-roast inner loop`);
    }
    if (!content.includes("Do not start the next task until Roast PASS")) {
      errors.push(`${prefix}: must require Roast PASS before the next task`);
    }
  }

  if (definition.stage === "pick") {
    if (!content.includes("Pick never skips Roast")) {
      errors.push(`${prefix}: Pick must not skip Roast`);
    }
    if (!content.includes("repeat from Reconstruct")) {
      errors.push(`${prefix}: must rediscover docs and skills on the next task`);
    }
    if (!content.includes("Exactly one driver continues")) {
      errors.push(`${prefix}: must name a single inner-loop driver`);
    }
    if (!content.includes("Roast never invokes Pick")) {
      errors.push(`${prefix}: Pick must treat Roast as prove-only`);
    }
  }

  if (definition.stage === "roast") {
    if (!content.includes("Exactly one driver continues")) {
      errors.push(`${prefix}: must name a single inner-loop driver`);
    }
    if (!content.includes("Roast never invokes Pick")) {
      errors.push(`${prefix}: Roast must never invoke Pick`);
    }
    if (!content.includes("Pick owns the inner loop")) {
      errors.push(`${prefix}: Roast must name Pick as the inner-loop driver`);
    }
  }

  if (definition.stage === "brew") {
    if (!content.includes("../../references/github-attention-contract.md")) {
      errors.push(`${prefix}: Brew must load the GitHub attention contract`);
    }
    if (!content.includes("../../references/async-review-bots.md")) {
      errors.push(`${prefix}: Brew must load the async review-bot wait procedure`);
    }
    if (!content.includes("../../references/product-ci.md")) {
      errors.push(`${prefix}: Brew must load the product-CI procedure`);
    }
    if (!content.includes("every discovered CI host")) {
      errors.push(`${prefix}: Brew must confirm product CI on every discovered CI host`);
    }
    if (!content.includes("Do not exit while")) {
      errors.push(`${prefix}: Brew must wait in-process for running review bots`);
    }
    if (!content.includes("provider CLI watch hooks")) {
      errors.push(`${prefix}: Brew must prefer provider CLI watch hooks over sleep polling`);
    }
    if (!content.includes("required host untriggered after grace")) {
      errors.push(`${prefix}: Brew must fail when a required CI host remains untriggered`);
    }
    if (!content.includes("Brew itself never executes Taste")) {
      errors.push(`${prefix}: must explicitly terminate without executing Taste`);
    }
    if (/execute(?:s| the)? \*\*?Taste|execute(?:s| the)? Taste procedure/i.test(content)) {
      errors.push(`${prefix}: Brew must not execute Taste in the same invocation`);
    }
  }

  if (definition.stage === "taste") {
    if (!content.includes("../../references/github-attention-contract.md")) {
      errors.push(`${prefix}: Taste must load the GitHub attention contract`);
    }
    if (!content.includes("../../references/async-review-bots.md")) {
      errors.push(`${prefix}: Taste must load the async review-bot wait procedure`);
    }
    if (!content.includes("../../references/product-ci.md")) {
      errors.push(`${prefix}: Taste must load the product-CI procedure`);
    }
    if (!content.includes("not only GitHub checks")) {
      errors.push(`${prefix}: Taste must observe jobs on every discovered CI host, not only GitHub checks`);
    }
    if (!content.includes("Do not exit while")) {
      errors.push(`${prefix}: Taste must wait in-process for running review bots`);
    }
    if (!content.includes("provider CLI watch hooks")) {
      errors.push(`${prefix}: Taste must prefer provider CLI watch hooks over sleep polling`);
    }
    if (!content.includes("documented path-filter/config")) {
      errors.push(`${prefix}: Taste must treat documented non-applicable hosts as skipped`);
    }
    if (!content.includes("one reactive iteration only")) {
      errors.push(`${prefix}: must be bounded to one reactive iteration`);
    }
    if (!content.includes("If step 9 did not push")) {
      errors.push(`${prefix}: Taste must preserve an emit path when no fix was pushed`);
    }
    if (!content.includes("latest `master`")) {
      errors.push(`${prefix}: Taste must pull latest master before lint and push`);
    }
    if (!content.includes("Before any push, in this order")) {
      errors.push(`${prefix}: Taste must order before-push as pull, then lint, then watch`);
    }
    if (!content.includes("fresh subagent")) {
      errors.push(`${prefix}: Taste must spawn a fresh subagent for local lint and tests`);
    }
    if (!content.includes("no parent conversation")) {
      errors.push(`${prefix}: Taste's lint/test subagent must have no parent conversation`);
    }
    if (!content.includes("bun lint")) {
      errors.push(`${prefix}: Taste must run bun lint in each affected package`);
    }
    if (!content.includes("locally affected tests")) {
      errors.push(`${prefix}: Taste must run locally affected tests before push`);
    }
    if (!content.includes("gh pr checks <pr> --watch")) {
      errors.push(`${prefix}: Taste must wait for GitHub product CI with gh pr checks --watch`);
    }
    if (!content.includes("circleci run watch --sha <sha>")) {
      errors.push(`${prefix}: Taste must wait for CircleCI with circleci run watch`);
    }
    if (!content.includes("watch → snapshot cycle in a loop")) {
      errors.push(`${prefix}: Taste must wait for product CI in a watch loop`);
    }
    for (const pattern of TASTE_UNBOUNDED_LOOP_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(
          `${prefix}: contains an unbounded waiting/loop pattern: ${pattern.source}`
        );
      }
    }
  }

  return errors;
};

export const validateDocumentationContract = (content: string): string[] => {
  const errors: string[] = [];
  const requiredPhrases = [
    "Always read docs first",
    "Always update docs",
    "Diátaxis",
    "Missing docs for a user-visible or architectural change is `FAIL`",
  ];

  for (const phrase of requiredPhrases) {
    if (!content.includes(phrase)) {
      errors.push(`Documentation contract is missing required phrase: ${phrase}`);
    }
  }

  return errors;
};

export const validateGithubAttentionContract = (content: string): string[] => {
  const errors: string[] = [];

  for (const heading of PR_HEADINGS) {
    if (!content.includes(heading)) {
      errors.push(`GitHub attention contract is missing required heading ${heading}`);
    }
  }

  for (const heading of PR_FORBIDDEN_HEADINGS) {
    if (content.includes(heading)) {
      errors.push(`GitHub attention contract contains forbidden heading ${heading}`);
    }
  }

  if (!content.includes("Default to silence")) {
    errors.push("GitHub attention contract must default PR comments to silence");
  }
  if (!content.includes("<details>")) {
    errors.push("GitHub attention contract must put optional detail behind disclosure");
  }

  return errors;
};

export const validateProductCiContract = (content: string): string[] => {
  const errors: string[] = [];
  for (const nativeWait of [
    "gh pr checks <pr> --watch",
    "circleci run watch --sha <sha>",
    "bk build watch <build-number>",
  ]) {
    if (!content.includes(nativeWait)) {
      errors.push(`product-CI procedure is missing native wait hook: ${nativeWait}`);
    }
  }
  if (!content.includes("Only then fall back to bounded")) {
    errors.push("product-CI procedure must make sleep polling the final fallback");
  }
  for (const nonBlockingQuery of [
    "circleci run list --branch <branch> --json",
    "bk build list --commit <sha> --json",
  ]) {
    if (!content.includes(nonBlockingQuery)) {
      errors.push(`product-CI procedure is missing non-blocking stage query: ${nonBlockingQuery}`);
    }
  }
  if (!content.includes("Taste waits in-process with these blocking watch hooks")) {
    errors.push("product-CI procedure must wait in-process in Taste with blocking watch hooks");
  }
  if (!content.includes("Never emit Brew `PASS`")) {
    errors.push("product-CI procedure must reject unexplained untriggered hosts");
  }
  if (!content.includes("counts as terminal `skipped`")) {
    errors.push("product-CI procedure must terminate documented non-applicable hosts");
  }
  return errors;
};

export const validateAsyncReviewBotsContract = (content: string): string[] => {
  const errors: string[] = [];
  if (!content.includes("gh run watch <run-id>")) {
    errors.push("review-bot procedure must use targeted GitHub Actions run watching");
  }
  if (!content.includes("Do **not** use unfiltered")) {
    errors.push("review-bot procedure must forbid unfiltered PR-check watching");
  }
  if (!content.includes("harness PR-event subscription")) {
    errors.push("review-bot procedure must prefer harness PR-event subscriptions");
  }
  if (content.includes("`gh pr checks <pr> --watch")) {
    errors.push("review-bot procedure must not wait on all PR product checks");
  }
  if (content.includes("gh run watch <run-id> --exit-status")) {
    errors.push("review-bot procedure must not turn a bot failure into Brew command failure");
  }
  return errors;
};

export const validateOuterLoopContent = ({
  content,
  directory,
}: {
  content: string;
  directory: string;
}): string[] => {
  const errors: string[] = [];
  if (!content.includes("../../references/product-ci.md")) {
    errors.push(`${directory}: outer loop must load the product-CI procedure`);
  }
  if (!content.includes("native watch hook")) {
    errors.push(`${directory}: outer loop must prefer native watch hooks for PENDING`);
  }
  if (!content.includes("only when no hook applies")) {
    errors.push(`${directory}: outer loop must make timer waiting the fallback`);
  }
  return errors;
};

/**
 * The Claude Code plugin is a generated copy with shortened stage names, because
 * Claude Code resolves a plugin skill's command from the frontmatter `name`.
 * Cursor and `npx skills` keep the canonical `terreno-<n>-<stage>` names.
 */
export const validateClaudePluginHost = ({
  rootDirectory,
}: ValidateLifecyclePluginOptions): string[] => {
  const errors: string[] = [];
  const claudeDirectory = join(rootDirectory, "plugins/terreno-claude");
  const claudeManifest = JSON.parse(
    readFileSync(join(claudeDirectory, ".claude-plugin/plugin.json"), "utf8")
  ) as {description?: string; name?: string; skills?: string; version?: string};
  const cursorManifest = JSON.parse(
    readFileSync(
      join(rootDirectory, "plugins/terreno-planning/.cursor-plugin/plugin.json"),
      "utf8"
    )
  ) as {description?: string; version?: string};
  const claudeMarketplace = JSON.parse(
    readFileSync(join(rootDirectory, ".claude-plugin/marketplace.json"), "utf8")
  ) as {name?: string; plugins?: Array<{name?: string; source?: string}>};

  if (claudeManifest.name !== "terreno") {
    errors.push("Claude plugin name must be terreno so stages resolve as /terreno:<stage>");
  }
  if (claudeManifest.version !== cursorManifest.version) {
    errors.push("Claude and Cursor plugin versions must match");
  }
  if (claudeManifest.description !== cursorManifest.description) {
    errors.push("Claude and Cursor plugin descriptions must match");
  }
  if (claudeManifest.skills !== "./skills/") {
    errors.push("Claude plugin skills path must be ./skills/");
  }

  if (!claudeMarketplace.name || claudeMarketplace.name === claudeManifest.name) {
    errors.push(
      "Claude marketplace name must differ from plugin name terreno (Claude Code cache collision)"
    );
  }

  const [claudeEntry] = claudeMarketplace.plugins ?? [];
  if (claudeEntry?.name !== "terreno") {
    errors.push("Claude marketplace must publish the plugin as terreno");
  }
  if (claudeEntry?.source !== "./plugins/terreno-claude") {
    errors.push("Claude marketplace source must be ./plugins/terreno-claude");
  }

  const claudeStages = readdirSync(join(claudeDirectory, "skills"), {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expectedClaudeStages = STAGE_DEFINITIONS.map(({directory}) =>
    directory.replace(/^terreno-/, "")
  ).sort();
  if (JSON.stringify(claudeStages) !== JSON.stringify(expectedClaudeStages)) {
    errors.push(
      `Claude plugin stages must be exactly ${expectedClaudeStages.join(", ")}; found ${claudeStages.join(", ")}`
    );
  }

  for (const stageDirectory of claudeStages) {
    const content = readFileSync(
      join(claudeDirectory, "skills", stageDirectory, "SKILL.md"),
      "utf8"
    );
    if (!content.includes(`name: ${stageDirectory}`)) {
      errors.push(`Claude stage ${stageDirectory} frontmatter name must be ${stageDirectory}`);
    }
  }

  const claudePick = readFileSync(
    join(claudeDirectory, "skills/2-pick/SKILL.md"),
    "utf8"
  );
  const claudeRoast = readFileSync(
    join(claudeDirectory, "skills/3-roast/SKILL.md"),
    "utf8"
  );
  const claudePickRoastLoop = readFileSync(
    join(claudeDirectory, "references/pick-roast-loop.md"),
    "utf8"
  );
  for (const [label, content] of [
    ["Claude 2-pick", claudePick],
    ["Claude 3-roast", claudeRoast],
  ] as const) {
    if (!content.includes("../../references/pick-roast-loop.md")) {
      errors.push(`${label} must load the pick-roast inner loop`);
    }
    if (!content.includes("Do not start the next task until Roast PASS")) {
      errors.push(`${label} must require Roast PASS before the next task`);
    }
    if (!content.includes("Roast never invokes Pick")) {
      errors.push(`${label} must treat Roast as prove-only`);
    }
  }
  if (!claudePick.includes("repeat from Reconstruct")) {
    errors.push("Claude 2-pick must rediscover docs and skills on the next task");
  }
  if (!claudeRoast.includes("Pick owns the inner loop")) {
    errors.push("Claude 3-roast must name Pick as the inner-loop driver");
  }
  if (!claudePickRoastLoop.includes("Roast never invokes Pick")) {
    errors.push("Claude pick-roast loop must forbid Roast from invoking Pick");
  }

  return errors;
};

/**
 * Codex installs the canonical plugin: `.codex-plugin/plugin.json` plus a repo
 * marketplace at `.agents/plugins/marketplace.json`. Stage names stay
 * `terreno-<n>-<stage>` (`$terreno-1-grow`).
 */
export const validateCodexPluginHost = ({
  rootDirectory,
}: ValidateLifecyclePluginOptions): string[] => {
  const errors: string[] = [];
  const pluginDirectory = join(rootDirectory, "plugins/terreno-planning");
  const cursorManifest = JSON.parse(
    readFileSync(join(pluginDirectory, ".cursor-plugin/plugin.json"), "utf8")
  ) as {description?: string; name?: string; version?: string};
  const codexManifest = JSON.parse(
    readFileSync(join(pluginDirectory, ".codex-plugin/plugin.json"), "utf8")
  ) as {description?: string; name?: string; skills?: string; version?: string};
  const codexMarketplace = JSON.parse(
    readFileSync(join(rootDirectory, ".agents/plugins/marketplace.json"), "utf8")
  ) as {
    name?: string;
    plugins?: Array<{
      category?: string;
      name?: string;
      policy?: {authentication?: string; installation?: string};
      source?: {path?: string; source?: string};
    }>;
  };

  if (codexManifest.name !== "terreno-planning") {
    errors.push("Codex plugin name must be terreno-planning");
  }
  if (codexManifest.version !== cursorManifest.version) {
    errors.push("Codex and Cursor plugin versions must match");
  }
  if (codexManifest.description !== cursorManifest.description) {
    errors.push("Codex and Cursor plugin descriptions must match");
  }
  if (codexManifest.skills !== "./skills/") {
    errors.push("Codex plugin skills path must be ./skills/");
  }
  if (codexMarketplace.name !== "terreno-plugins") {
    errors.push("Codex marketplace name must be terreno-plugins");
  }

  const [codexEntry] = codexMarketplace.plugins ?? [];
  if (codexEntry?.name !== "terreno-planning") {
    errors.push("Codex marketplace must publish the plugin as terreno-planning");
  }
  if (codexEntry?.source?.source !== "local") {
    errors.push("Codex marketplace source.source must be local");
  }
  if (codexEntry?.source?.path !== "./plugins/terreno-planning") {
    errors.push("Codex marketplace source.path must be ./plugins/terreno-planning");
  }
  if (codexEntry?.policy?.installation !== "AVAILABLE") {
    errors.push("Codex marketplace policy.installation must be AVAILABLE");
  }
  if (codexEntry?.policy?.authentication !== "ON_INSTALL") {
    errors.push("Codex marketplace policy.authentication must be ON_INSTALL");
  }
  if (codexEntry?.category !== "Development & Workflow") {
    errors.push("Codex marketplace category must be Development & Workflow");
  }

  return errors;
};

export const validateLifecyclePlugin = ({
  rootDirectory,
}: ValidateLifecyclePluginOptions): string[] => {
  const errors: string[] = [];
  const pluginDirectory = join(rootDirectory, "plugins/terreno-planning");
  const skillsDirectory = join(rootDirectory, "plugins/terreno-planning/skills");
  const actualStageDirectories = readdirSync(skillsDirectory, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && /^terreno-\d-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const expectedStageDirectories = STAGE_DEFINITIONS.map(({directory}) => directory).sort();

  if (JSON.stringify(actualStageDirectories) !== JSON.stringify(expectedStageDirectories)) {
    errors.push(
      `plugin lifecycle directories must be exactly ${expectedStageDirectories.join(", ")}; found ${actualStageDirectories.join(", ")}`
    );
  }

  for (const directory of OUTER_LOOP_DIRECTORIES) {
    const skillPath = join(skillsDirectory, directory, "SKILL.md");
    if (!existsSync(skillPath)) {
      errors.push(`plugin outer-loop skill is missing: ${directory}`);
      continue;
    }
    const content = readFileSync(skillPath, "utf8");
    errors.push(...validateOuterLoopContent({content, directory}));
  }

  for (const definition of STAGE_DEFINITIONS) {
    const skillPath = join(skillsDirectory, definition.directory, "SKILL.md");
    const content = readFileSync(skillPath, "utf8");
    errors.push(...validateStageContent({content, definition}));
    if (content.includes("Cupping")) {
      errors.push(`${definition.directory}: Cupping terminology must be migrated to Roast`);
    }
  }

  for (const {content, path} of readMarkdownFiles(join(pluginDirectory, "references"))) {
    for (const marker of PORTABILITY_MARKERS) {
      if (content.includes(marker)) {
        errors.push(`portable plugin reference ${path} contains repository marker ${marker}`);
      }
    }
  }

  const attentionContract = readFileSync(
    join(pluginDirectory, "references/github-attention-contract.md"),
    "utf8"
  );
  errors.push(...validateGithubAttentionContract(attentionContract));

  const documentationContract = readFileSync(
    join(pluginDirectory, "references/documentation-contract.md"),
    "utf8"
  );
  errors.push(...validateDocumentationContract(documentationContract));

  const productCi = readFileSync(
    join(pluginDirectory, "references/product-ci.md"),
    "utf8"
  );
  errors.push(...validateProductCiContract(productCi));

  const asyncReviewBots = readFileSync(
    join(pluginDirectory, "references/async-review-bots.md"),
    "utf8"
  );
  errors.push(...validateAsyncReviewBotsContract(asyncReviewBots));

  const pluginReadme = readFileSync(join(rootDirectory, "plugins/README.md"), "utf8");
  if (!pluginReadme.includes("documentation-contract.md")) {
    errors.push("plugins/README.md must document the documentation contract");
  }
  if (!pluginReadme.includes("npx skills add FlourishHealth/terreno")) {
    errors.push("plugins/README.md must document npx skills installation");
  }
  if (!pluginReadme.includes("product-ci.md")) {
    errors.push("plugins/README.md must document the product-CI procedure");
  }
  if (!pluginReadme.includes("pick-roast-loop.md")) {
    errors.push("plugins/README.md must document the pick-roast inner loop");
  }
  if (!pluginReadme.includes(".claude-plugin/marketplace.json")) {
    errors.push("plugins/README.md must document the Claude Code marketplace");
  }
  if (!pluginReadme.includes("/plugin marketplace add FlourishHealth/terreno")) {
    errors.push("plugins/README.md must document Claude Code marketplace install");
  }
  if (!pluginReadme.includes("/plugin install terreno@terreno-plugins")) {
    errors.push("plugins/README.md must document Claude Code install as terreno@terreno-plugins");
  }
  if (!pluginReadme.includes(".agents/plugins/marketplace.json")) {
    errors.push("plugins/README.md must document the Codex marketplace");
  }
  if (!pluginReadme.includes("codex plugin marketplace add FlourishHealth/terreno")) {
    errors.push("plugins/README.md must document Codex marketplace install");
  }
  if (!pluginReadme.includes("codex plugin install terreno-planning --source terreno-plugins")) {
    errors.push("plugins/README.md must document Codex install as terreno-planning");
  }

  const pullRequestTemplate = readFileSync(
    join(rootDirectory, ".github/PULL_REQUEST_TEMPLATE.md"),
    "utf8"
  );
  for (const heading of PR_HEADINGS) {
    if (!pullRequestTemplate.includes(heading)) {
      errors.push(`pull request template is missing required heading ${heading}`);
    }
  }
  for (const heading of PR_FORBIDDEN_HEADINGS) {
    if (pullRequestTemplate.includes(heading)) {
      errors.push(`pull request template contains retired heading ${heading}`);
    }
  }

  const pluginFiles = [
    join(pluginDirectory, ".cursor-plugin/plugin.json"),
    join(pluginDirectory, ".codex-plugin/plugin.json"),
    join(rootDirectory, ".cursor-plugin/marketplace.json"),
    join(rootDirectory, ".agents/plugins/marketplace.json"),
    join(rootDirectory, "CONTRIBUTING.md"),
  ];
  const canonicalText = pluginFiles.map((path) => readFileSync(path, "utf8")).join("\n");

  errors.push(...validateClaudePluginHost({rootDirectory}));
  errors.push(...validateCodexPluginHost({rootDirectory}));

  for (const retiredIdentifier of RETIRED_IDENTIFIERS) {
    if (canonicalText.includes(retiredIdentifier)) {
      errors.push(`active plugin metadata/docs contain retired identifier ${retiredIdentifier}`);
    }
  }

  const migrationDocumentation = readFileSync(
    join(rootDirectory, "plugins/README.md"),
    "utf8"
  );
  for (const retiredIdentifier of RETIRED_IDENTIFIERS) {
    if (!migrationDocumentation.includes(retiredIdentifier)) {
      errors.push(`migration documentation is missing retired identifier ${retiredIdentifier}`);
    }
  }

  const resultSchema = JSON.parse(
    readFileSync(join(pluginDirectory, "references/stage-result.schema.json"), "utf8")
  ) as {
    properties?: {
      stage?: {enum?: string[]};
      status?: {enum?: string[]};
      v?: {const?: number};
    };
    required?: string[];
  };
  const schemaStages = resultSchema.properties?.stage?.enum ?? [];
  const schemaStatuses = resultSchema.properties?.status?.enum ?? [];

  if (resultSchema.properties?.v?.const !== 2) {
    errors.push("stage-result schema v must be 2");
  }
  if (JSON.stringify(resultSchema.required) !== JSON.stringify(["v", "stage", "status", "next", "action"])) {
    errors.push("stage-result schema must require only v, stage, status, next, action");
  }
  if (JSON.stringify(schemaStages) !== JSON.stringify(LIFECYCLE_STAGES)) {
    errors.push("stage-result schema stage values do not match canonical lifecycle");
  }
  if (JSON.stringify(schemaStatuses) !== JSON.stringify(RESULT_STATUSES)) {
    errors.push("stage-result schema statuses must be PASS, FAIL, BLOCKED, PENDING");
  }

  const lifecycleContract = readFileSync(
    join(pluginDirectory, "references/lifecycle-contract.md"),
    "utf8"
  );
  if (!lifecycleContract.includes("<details>")) {
    errors.push("lifecycle contract must hide stage YAML behind disclosure");
  }
  if (!lifecycleContract.includes("Omit nulls and empty arrays")) {
    errors.push("lifecycle contract must omit empty stage-result keys");
  }
  if (!lifecycleContract.includes("pick-roast-loop.md")) {
    errors.push("lifecycle contract must name the pick-roast inner loop");
  }

  const loopEngineering = readFileSync(
    join(pluginDirectory, "references/loop-engineering.md"),
    "utf8"
  );
  if (!loopEngineering.includes("pick-roast-loop.md")) {
    errors.push("loop engineering must load the pick-roast inner loop");
  }
  if (!loopEngineering.includes("Do not start the next task until Roast PASS")) {
    errors.push("loop engineering must require Roast PASS before the next task");
  }
  if (!loopEngineering.includes("Exactly one driver continues")) {
    errors.push("loop engineering must name a single inner-loop driver");
  }
  if (!loopEngineering.includes("Roast never invokes Pick")) {
    errors.push("loop engineering must forbid Roast from invoking Pick");
  }
  if (loopEngineering.includes("run independent tasks in parallel")) {
    errors.push("loop engineering must not pick tasks in parallel without roasting each");
  }

  const pickRoastLoop = readFileSync(
    join(pluginDirectory, "references/pick-roast-loop.md"),
    "utf8"
  );
  if (!pickRoastLoop.includes("Roast never invokes Pick")) {
    errors.push("pick-roast loop must forbid Roast from invoking Pick");
  }
  if (pickRoastLoop.includes("entry Roast may invoke Pick")) {
    errors.push("pick-roast loop must not let entry Roast invoke Pick");
  }

  const executionSchema = JSON.parse(
    readFileSync(join(pluginDirectory, "references/execution-state.schema.json"), "utf8")
  ) as {properties?: {stage?: {enum?: string[]}; v?: {const?: number}}};
  const executionStages = executionSchema.properties?.stage?.enum ?? [];
  if (executionSchema.properties?.v?.const !== 2) {
    errors.push("execution-state schema v must be 2");
  }
  if (JSON.stringify(executionStages) !== JSON.stringify(LIFECYCLE_STAGES)) {
    errors.push("execution-state schema stage values do not match canonical lifecycle");
  }

  return errors;
};
