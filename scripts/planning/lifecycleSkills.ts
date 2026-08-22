import {readFileSync, readdirSync} from "node:fs";
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

const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    directory: "terreno-1-grow",
    nextMarkers: [
      "recommended_next_stage: pick",
      "recommended_next_stage: grow",
      "recommended_next_stage: null",
    ],
    stage: "grow",
  },
  {
    directory: "terreno-2-pick",
    nextMarkers: [
      "recommended_next_stage: roast",
      "recommended_next_stage: pick",
      "recommended_next_stage: null",
    ],
    stage: "pick",
  },
  {
    directory: "terreno-3-roast",
    nextMarkers: [
      "recommended_next_stage: brew",
      "recommended_next_stage: pick",
      "recommended_next_stage: null",
    ],
    stage: "roast",
  },
  {
    directory: "terreno-4-brew",
    nextMarkers: [
      "recommended_next_stage: taste",
      "recommended_next_stage: pick",
      "recommended_next_stage: roast",
      "recommended_next_stage: brew",
      "recommended_next_stage: null",
    ],
    stage: "brew",
  },
  {
    directory: "terreno-5-taste",
    nextMarkers: ["recommended_next_stage: taste", "recommended_next_stage: null"],
    stage: "taste",
  },
];

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

const TASTE_LOOP_PATTERNS = [
  /\bsleep\b/i,
  /\bpoll(?:ing)?\b/i,
  /keep the loop active/i,
  /continue the loop/i,
  /wait\s+\d/i,
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

  if (definition.stage === "brew") {
    if (!content.includes("Brew itself never executes Taste")) {
      errors.push(`${prefix}: must explicitly terminate without executing Taste`);
    }
    if (/execute(?:s| the)? \*\*?Taste|execute(?:s| the)? Taste procedure/i.test(content)) {
      errors.push(`${prefix}: Brew must not execute Taste in the same invocation`);
    }
  }

  if (definition.stage === "taste") {
    if (!content.includes("one reactive iteration only")) {
      errors.push(`${prefix}: must be bounded to one reactive iteration`);
    }
    for (const pattern of TASTE_LOOP_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(
          `${prefix}: contains an internal waiting/loop pattern: ${pattern.source}`
        );
      }
    }
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

  const pluginFiles = [
    join(pluginDirectory, ".cursor-plugin/plugin.json"),
    join(rootDirectory, ".cursor-plugin/marketplace.json"),
    join(rootDirectory, "CONTRIBUTING.md"),
  ];
  const canonicalText = pluginFiles.map((path) => readFileSync(path, "utf8")).join("\n");

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
  ) as {properties?: {stage?: {enum?: string[]}; status?: {enum?: string[]}}};
  const schemaStages = resultSchema.properties?.stage?.enum ?? [];
  const schemaStatuses = resultSchema.properties?.status?.enum ?? [];

  if (JSON.stringify(schemaStages) !== JSON.stringify(LIFECYCLE_STAGES)) {
    errors.push("stage-result schema stage values do not match canonical lifecycle");
  }
  if (JSON.stringify(schemaStatuses) !== JSON.stringify(RESULT_STATUSES)) {
    errors.push("stage-result schema statuses must be PASS, FAIL, BLOCKED, PENDING");
  }

  const executionSchema = JSON.parse(
    readFileSync(join(pluginDirectory, "references/execution-state.schema.json"), "utf8")
  ) as {properties?: {stage?: {enum?: string[]}}};
  const executionStages = executionSchema.properties?.stage?.enum ?? [];
  if (JSON.stringify(executionStages) !== JSON.stringify(LIFECYCLE_STAGES)) {
    errors.push("execution-state schema stage values do not match canonical lifecycle");
  }

  return errors;
};
