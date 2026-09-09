import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {join, relative, resolve} from "node:path";

interface SyncInstallableSkillsOptions {
  check?: boolean;
  rootDirectory: string;
}

interface SkillGroup {
  description: string;
  skills: string[];
  title: string;
}

const PACKAGE_SKILL_OWNERS = [
  "api",
  "ui",
  "rtk",
  "admin-backend",
  "admin-frontend",
] as const;

const SHARED_PLUGIN_REFERENCE_PREFIX = "../../references/";

export const SKILL_GROUPS: SkillGroup[] = [
  {
    title: "Lifecycle",
    description: "Bounded Grow → Pick/Roast inner loop → Brew → Taste, plus planning-loop and taste-sweep outer loops.",
    skills: [
      "terreno-1-grow",
      "terreno-2-pick",
      "terreno-3-roast",
      "terreno-4-brew",
      "terreno-5-taste",
      "terreno-planning-loop",
      "terreno-taste-sweep",
    ],
  },
  {
    title: "Terreno apps",
    description: "Backend, UI, data, and schema conventions for Terreno apps.",
    skills: [
      "terreno-backend-api",
      "terreno-ui",
      "terreno-data-fetching",
      "mongoose-schema-safety",
      "generate-sdk",
      "building-terreno-apps",
      "building-admin-interfaces",
      "backend-test-env",
      "ai-prompt-governance",
    ],
  },
  {
    title: "Docs and architecture",
    description: "Read architecture docs first; write and regenerate them in the same slice.",
    skills: [
      "update-docs",
      "update-agent-docs",
      "docs-audit",
      "improve-codebase-architecture",
      "improve-rulesync",
      "build-terreno-app",
      "design-blend",
    ],
  },
  {
    title: "GitHub and shipping",
    description: "Commit, PR, review, verification, release, and deploy workflows.",
    skills: [
      "commit",
      "create-github-issue",
      "create-pr",
      "respond-to-review",
      "verify-ui-changes",
      "work-github-issues",
      "fix-conflicts",
      "release",
      "deploy-gcp",
    ],
  },
  {
    title: "Roadmap",
    description: "Frontier, triage, promote, item, and review skills for the roadmap.",
    skills: [
      "roadmap-frontier",
      "roadmap-item",
      "roadmap-promote",
      "roadmap-review",
      "roadmap-triage",
      "claude-design-to-linear",
    ],
  },
  {
    title: "Expo and native",
    description: "Expo, native modules, and platform-specific app skills.",
    skills: [
      "add-app-clip",
      "building-native-ui",
      "eas-update-insights",
      "expo-api-routes",
      "expo-brownfield",
      "expo-cicd-workflows",
      "expo-deployment",
      "expo-dev-client",
      "expo-module",
      "expo-observe",
      "expo-tailwind-setup",
      "expo-ui",
      "native-data-fetching",
      "upgrading-expo",
      "use-dom",
    ],
  },
];

const INSTALLABLE_README = `# Installable Terreno skills

Install from GitHub with the skills CLI:

\`\`\`bash
npx skills add FlourishHealth/terreno
npx skills add FlourishHealth/terreno --skill terreno-1-grow
\`\`\`

This directory is generated. Canonical sources:

| Source | Owns |
| --- | --- |
| \`plugins/terreno-planning/skills/\` | Grow, Pick, Roast, Brew, Taste, plus planning-loop and taste-sweep |
| \`.rulesync/skills/\` | Repository and domain skills |
| \`<package>/.ai/skills/\` | Published package skills (overlay the repo copies) |

Regenerate with \`bun run skills:sync\`. Human-facing docs stay the architecture source;
follow \`update-docs\` and the lifecycle documentation contract.
`;

const listDirectories = (directory: string): string[] => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

const listSkillDirectories = (directory: string): string[] =>
  listDirectories(directory).filter((name) => existsSync(join(directory, name, "SKILL.md")));

export const rewriteSharedPluginLinks = (content: string): string =>
  content.replaceAll(SHARED_PLUGIN_REFERENCE_PREFIX, "references/");

const writeCopiedTree = ({
  destination,
  source,
  transformMarkdown,
}: {
  destination: string;
  source: string;
  transformMarkdown?: (content: string) => string;
}): void => {
  mkdirSync(destination, {recursive: true});

  for (const entry of readdirSync(source, {withFileTypes: true})) {
    const fromPath = join(source, entry.name);
    const toPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      writeCopiedTree({destination: toPath, source: fromPath, transformMarkdown});
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (transformMarkdown && entry.name.endsWith(".md")) {
      writeFileSync(toPath, transformMarkdown(readFileSync(fromPath, "utf8")));
      continue;
    }
    cpSync(fromPath, toPath);
  }
};

const collectFiles = (directory: string, files: string[] = []): string[] => {
  if (!existsSync(directory)) {
    return files;
  }

  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(path, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files.sort();
};

const snapshotTree = (directory: string): Map<string, string> => {
  const snapshot = new Map<string, string>();
  if (!existsSync(directory)) {
    return snapshot;
  }

  for (const filePath of collectFiles(directory)) {
    snapshot.set(relative(directory, filePath), readFileSync(filePath, "utf8"));
  }
  return snapshot;
};

export const listedSkillNames = (): string[] =>
  SKILL_GROUPS.flatMap((group) => group.skills).sort();

export const validateSkillGroupings = (skillNames: string[]): string[] => {
  const errors: string[] = [];
  const listed = listedSkillNames();
  const seen = new Set<string>();

  for (const skillName of listed) {
    if (seen.has(skillName)) {
      errors.push(`skill grouping lists ${skillName} more than once`);
    }
    seen.add(skillName);
    if (!skillNames.includes(skillName)) {
      errors.push(`skill grouping lists missing skill ${skillName}`);
    }
  }

  for (const skillName of skillNames) {
    if (!seen.has(skillName)) {
      errors.push(`installable skill ${skillName} is missing from skills.sh.json groupings`);
    }
  }

  return errors;
};

export const buildSkillsShConfig = (skillNames: string[]): {
  config: Record<string, unknown>;
  errors: string[];
} => {
  const errors = validateSkillGroupings(skillNames);
  return {
    config: {
      $schema: "https://skills.sh/schemas/skills.sh.schema.json",
      notGrouped: "bottom",
      groupings: SKILL_GROUPS,
    },
    errors,
  };
};

export const buildInstallableSkillsTree = ({
  destination,
  rootDirectory,
}: {
  destination: string;
  rootDirectory: string;
}): void => {
  rmSync(destination, {force: true, recursive: true});
  mkdirSync(destination, {recursive: true});

  const rulesyncSkills = join(rootDirectory, ".rulesync/skills");
  for (const skillName of listSkillDirectories(rulesyncSkills)) {
    writeCopiedTree({
      destination: join(destination, skillName),
      source: join(rulesyncSkills, skillName),
    });
  }

  const pluginSkills = join(rootDirectory, "plugins/terreno-planning/skills");
  const pluginReferences = join(rootDirectory, "plugins/terreno-planning/references");
  for (const skillName of listSkillDirectories(pluginSkills)) {
    const skillDestination = join(destination, skillName);
    writeCopiedTree({
      destination: skillDestination,
      source: join(pluginSkills, skillName),
      transformMarkdown: rewriteSharedPluginLinks,
    });
    writeCopiedTree({
      destination: join(skillDestination, "references"),
      source: pluginReferences,
    });
  }

  for (const packageName of PACKAGE_SKILL_OWNERS) {
    const packageSkills = join(rootDirectory, packageName, ".ai/skills");
    for (const skillName of listSkillDirectories(packageSkills)) {
      writeCopiedTree({
        destination: join(destination, skillName),
        source: join(packageSkills, skillName),
      });
    }
  }

  writeFileSync(join(destination, "README.md"), INSTALLABLE_README);
};

export const syncInstallableSkills = ({
  check = false,
  rootDirectory,
}: SyncInstallableSkillsOptions): string[] => {
  const destination = join(rootDirectory, "skills");
  const staged = join(rootDirectory, ".terreno-skills-sync");
  buildInstallableSkillsTree({destination: staged, rootDirectory});

  const skillNames = listSkillDirectories(staged);
  const {config, errors: groupingErrors} = buildSkillsShConfig(skillNames);
  const expectedConfigText = `${JSON.stringify(config, null, 2)}\n`;
  const configPath = join(rootDirectory, "skills.sh.json");
  const expected = snapshotTree(staged);
  const actual = snapshotTree(destination);
  const errors = [...groupingErrors];

  for (const [relativePath, contents] of expected) {
    if (!actual.has(relativePath)) {
      errors.push(`installable skills missing ${relativePath}`);
      continue;
    }
    if (actual.get(relativePath) !== contents) {
      errors.push(`installable skills drift in ${relativePath}`);
    }
  }

  for (const relativePath of actual.keys()) {
    if (!expected.has(relativePath)) {
      errors.push(`installable skills has extra ${relativePath}`);
    }
  }

  if (!existsSync(configPath)) {
    errors.push("skills.sh.json is missing");
  } else if (readFileSync(configPath, "utf8") !== expectedConfigText) {
    errors.push("skills.sh.json drift");
  }

  if (check) {
    rmSync(staged, {force: true, recursive: true});
    return errors;
  }

  if (groupingErrors.length > 0) {
    rmSync(staged, {force: true, recursive: true});
    return groupingErrors;
  }

  if (existsSync(destination) && statSync(destination).isDirectory()) {
    rmSync(destination, {force: true, recursive: true});
  }
  cpSync(staged, destination, {recursive: true});
  rmSync(staged, {force: true, recursive: true});
  writeFileSync(configPath, expectedConfigText);
  return [];
};

if (import.meta.main) {
  const rootDirectory = resolve(import.meta.dir, "../..");
  const check = process.argv.includes("--check");
  const errors = syncInstallableSkills({check, rootDirectory});
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.info(check ? "Installable skills are in sync." : "Wrote skills/ and skills.sh.json.");
}
