import {existsSync, readdirSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(WEBSITE_ROOT, "..");
const TYPES_PATH = join(REPO_ROOT, "demo/ui-types-documentation.json");
const STORY_CONFIG_DIR = join(REPO_ROOT, "demo/story-config");

interface DriftItem {
  severity: "error" | "warning";
  message: string;
}

const issues: DriftItem[] = [];

const readMultilineString = (block: string, field: string): string | undefined => {
  const inline = block.match(new RegExp(`${field}:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (inline) {
    return inline[1].replace(/\\"/g, '"');
  }
  const multiline = block.match(new RegExp(`${field}:\\s*\\n\\s*"((?:\\\\.|[^"\\\\])*)"`));
  return multiline?.[1]?.replace(/\\"/g, '"');
};

const parseStoryConfigs = (): {name: string; interfaceName: string}[] =>
  readdirSync(STORY_CONFIG_DIR)
    .filter((file) => file.endsWith(".config.tsx"))
    .map((file) => {
      const source = readFileSync(join(STORY_CONFIG_DIR, file), "utf8");
      const blockMatch = source.match(
        /export const \w+Configuration: DemoConfiguration = \{([\s\S]*?)\n\};/
      );
      if (!blockMatch) {
        return undefined;
      }
      const block = blockMatch[1];
      const name = readMultilineString(block, "name");
      const interfaceName = block.match(/interfaceName:\s*"([^"]+)"/)?.[1];
      if (!name || !interfaceName) {
        return undefined;
      }
      return {interfaceName, name};
    })
    .filter((entry): entry is {name: string; interfaceName: string} => Boolean(entry));

const main = (): void => {
  if (!existsSync(TYPES_PATH)) {
    issues.push({message: `Missing ${TYPES_PATH}. Run cd ui && bun run types.`, severity: "error"});
  }

  const typedoc = existsSync(TYPES_PATH)
    ? (JSON.parse(readFileSync(TYPES_PATH, "utf8")) as {
        children?: {children?: {name: string; children?: unknown[]}[]}[];
      })
    : undefined;

  const interfaces = new Map(
    (typedoc?.children?.flatMap((module) => module.children ?? []) ?? []).map((node) => [
      node.name,
      node.children?.length ?? 0,
    ])
  );

  for (const entry of parseStoryConfigs()) {
    const storyFile = join(REPO_ROOT, `demo/stories/${entry.name.replace(/\s+/g, "")}.stories.tsx`);
    if (!existsSync(storyFile)) {
      issues.push({
        message: `Component "${entry.name}" is missing a demo story at demo/stories/${entry.name.replace(/\s+/g, "")}.stories.tsx`,
        severity: "warning",
      });
    }

    const propCount = interfaces.get(entry.interfaceName) ?? 0;
    if (propCount === 0) {
      issues.push({
        message: `Interface ${entry.interfaceName} (${entry.name}) has no TypeDoc props extracted.`,
        severity: "warning",
      });
    }
  }

  if (issues.length === 0) {
    console.info("Docs audit passed — no drift detected.");
    return;
  }

  console.error("Docs audit found issues:\n");
  for (const issue of issues) {
    console.error(`[${issue.severity}] ${issue.message}`);
  }
  const hasErrors = issues.some((issue) => issue.severity === "error");
  process.exit(hasErrors ? 1 : 0);
};

main();
