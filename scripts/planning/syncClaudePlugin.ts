/**
 * Generates the Claude Code plugin tree from the canonical lifecycle stages.
 *
 * Claude Code takes a plugin skill's command from the frontmatter `name`, so the
 * shortened `/terreno:1-grow` names cannot live in the shared stage files that
 * Cursor and `npx skills` consume. This emits a Claude-only copy instead.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {join, resolve} from "node:path";

interface SyncClaudePluginOptions {
  check?: boolean;
  rootDirectory: string;
}

interface GeneratedFile {
  contents: string;
  path: string;
}

export const CANONICAL_PLUGIN_DIRECTORY = "plugins/terreno-planning";
export const CLAUDE_PLUGIN_DIRECTORY = "plugins/terreno-claude";
export const CLAUDE_PLUGIN_NAME = "terreno";

const LONG_SKILL_NAME_PATTERN =
  /terreno-([1-5]-[a-z]+|pick-roast-loop|planning-loop|taste-sweep)/g;

const CLAUDE_PLUGIN_README = `# Terreno Claude Code plugin

Generated. Do not hand-edit. Run \`bun run skills:sync\`.

Claude Code resolves a plugin skill's command from the frontmatter \`name\`, so the
shortened stage names live here instead of in the shared stage files. This plugin is
named \`terreno\`, so Grow is \`/terreno:1-grow\`.

| Source | Owns |
| --- | --- |
| \`${CANONICAL_PLUGIN_DIRECTORY}/skills/\` | Lifecycle and Terreno app workflows |
| \`${CANONICAL_PLUGIN_DIRECTORY}/agents/\` | Reusable verification agents |
| \`${CANONICAL_PLUGIN_DIRECTORY}/references/\` | Shared lifecycle references |

Cursor and \`npx skills\` keep the canonical \`terreno-*\` names.
`;

export const shortenStageName = (stageName: string): string =>
  stageName.replace(LONG_SKILL_NAME_PATTERN, "$1");

export const rewriteStageNames = (contents: string): string =>
  contents.replace(LONG_SKILL_NAME_PATTERN, "$1");

/** Every canonical plugin skill; lifecycle names are shortened for Claude commands. */
const listSkillDirectories = (skillsDirectory: string): string[] =>
  readdirSync(skillsDirectory, {withFileTypes: true})
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(skillsDirectory, entry.name, "SKILL.md"))
    )
    .map((entry) => entry.name)
    .sort();

const listFilesRecursively = (directory: string, prefix = ""): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(join(directory, entry.name), relativePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files.sort();
};

const buildClaudeManifest = (rootDirectory: string): string => {
  const cursorManifest = JSON.parse(
    readFileSync(
      join(rootDirectory, CANONICAL_PLUGIN_DIRECTORY, ".cursor-plugin/plugin.json"),
      "utf8"
    )
  ) as {
    author: {email: string; name: string};
    compatibility: Record<string, string>;
    description: string;
    keywords: string[];
    version: string;
  };

  const manifest = {
    name: CLAUDE_PLUGIN_NAME,
    displayName: "Terreno",
    description: cursorManifest.description,
    version: cursorManifest.version,
    author: cursorManifest.author,
    homepage: "https://github.com/FlourishHealth/terreno/blob/master/plugins/README.md",
    repository: "https://github.com/FlourishHealth/terreno",
    license: "MIT",
    keywords: cursorManifest.keywords,
    skills: "./skills/",
    agents: ["./agents/"],
    metadata: {compatibility: cursorManifest.compatibility},
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
};

export const buildClaudePluginFiles = ({
  rootDirectory,
}: {
  rootDirectory: string;
}): GeneratedFile[] => {
  const canonicalDirectory = join(rootDirectory, CANONICAL_PLUGIN_DIRECTORY);
  const canonicalSkills = join(canonicalDirectory, "skills");
  const canonicalAgents = join(canonicalDirectory, "agents");
  const canonicalReferences = join(canonicalDirectory, "references");
  const files: GeneratedFile[] = [
    {contents: buildClaudeManifest(rootDirectory), path: ".claude-plugin/plugin.json"},
    {contents: readFileSync(join(canonicalDirectory, "LICENSE"), "utf8"), path: "LICENSE"},
    {contents: CLAUDE_PLUGIN_README, path: "README.md"},
  ];

  for (const skillName of listSkillDirectories(canonicalSkills)) {
    const shortName = shortenStageName(skillName);
    for (const relativePath of listFilesRecursively(join(canonicalSkills, skillName))) {
      const contents = readFileSync(join(canonicalSkills, skillName, relativePath), "utf8");
      files.push({
        contents: relativePath.endsWith(".md") ? rewriteStageNames(contents) : contents,
        path: `skills/${shortName}/${relativePath}`,
      });
    }
  }

  for (const relativePath of listFilesRecursively(canonicalAgents)) {
    files.push({
      contents: readFileSync(join(canonicalAgents, relativePath), "utf8"),
      path: `agents/${relativePath}`,
    });
  }

  for (const relativePath of listFilesRecursively(canonicalReferences)) {
    files.push({
      contents: readFileSync(join(canonicalReferences, relativePath), "utf8"),
      path: `references/${relativePath}`,
    });
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
};

export const syncClaudePlugin = ({
  check = false,
  rootDirectory,
}: SyncClaudePluginOptions): string[] => {
  const destination = join(rootDirectory, CLAUDE_PLUGIN_DIRECTORY);
  const files = buildClaudePluginFiles({rootDirectory});

  if (check) {
    const errors: string[] = [];
    const expected = new Set(files.map(({path}) => path));

    for (const {contents, path} of files) {
      const absolutePath = join(destination, path);
      if (!existsSync(absolutePath)) {
        errors.push(`Claude plugin missing ${CLAUDE_PLUGIN_DIRECTORY}/${path}`);
        continue;
      }
      if (readFileSync(absolutePath, "utf8") !== contents) {
        errors.push(`Claude plugin drift in ${CLAUDE_PLUGIN_DIRECTORY}/${path}`);
      }
    }

    if (existsSync(destination)) {
      for (const path of listFilesRecursively(destination)) {
        if (!expected.has(path)) {
          errors.push(`Claude plugin has extra ${CLAUDE_PLUGIN_DIRECTORY}/${path}`);
        }
      }
    }

    return errors;
  }

  rmSync(destination, {force: true, recursive: true});
  for (const {contents, path} of files) {
    const absolutePath = join(destination, path);
    mkdirSync(join(absolutePath, ".."), {recursive: true});
    writeFileSync(absolutePath, contents);
  }

  return [];
};

if (import.meta.main) {
  const rootDirectory = resolve(import.meta.dir, "../..");
  const check = process.argv.includes("--check");
  const errors = syncClaudePlugin({check, rootDirectory});
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.info(
    check ? `${CLAUDE_PLUGIN_DIRECTORY}/ is in sync.` : `Wrote ${CLAUDE_PLUGIN_DIRECTORY}/.`
  );
}
