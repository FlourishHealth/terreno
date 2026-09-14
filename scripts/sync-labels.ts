/**
 * Applies the label taxonomy in `.github/labels.yml` to a GitHub repository.
 *
 * Replaces the shell/sed loop that previously lived in the roadmap docs, which
 * silently dropped any description that was not fully double-quoted.
 */
import {parseArgs} from "node:util";

export interface LabelDefinition {
  name: string;
  color: string;
  description: string;
}

const HEX_COLOR_PATTERN = /^[0-9a-fA-F]{6}$/;

export const parseLabelsYaml = (contents: string): LabelDefinition[] => {
  const parsed = Bun.YAML.parse(contents);
  if (!Array.isArray(parsed)) {
    throw new Error("labels.yml must contain a top-level list of labels");
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`labels.yml entry ${index} is not a mapping`);
    }

    const {name, color, description} = entry as Record<string, unknown>;

    if (typeof name !== "string" || name === "") {
      throw new Error(`labels.yml entry ${index} is missing a name`);
    }
    if (typeof color !== "string" || !HEX_COLOR_PATTERN.test(color)) {
      throw new Error(`Label "${name}" needs a six-digit hex color without "#", got "${String(color)}"`);
    }
    if (typeof description !== "string" || description === "") {
      throw new Error(`Label "${name}" is missing a description`);
    }
    if (description.includes('"')) {
      throw new Error(`Label "${name}" description contains a stray quote: ${description}`);
    }

    return {color, description, name};
  });
};

export const findDuplicateNames = (labels: LabelDefinition[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const label of labels) {
    if (seen.has(label.name)) {
      duplicates.add(label.name);
    }
    seen.add(label.name);
  }
  return [...duplicates];
};

export const buildLabelCommand = (args: {label: LabelDefinition; repo: string}): string[] => {
  return [
    "gh",
    "label",
    "create",
    args.label.name,
    "--repo",
    args.repo,
    "--color",
    args.label.color,
    "--description",
    args.label.description,
    "--force",
  ];
};

export const main = async (): Promise<void> => {
  const {values} = parseArgs({
    options: {
      "dry-run": {default: false, type: "boolean"},
      file: {default: ".github/labels.yml", type: "string"},
      repo: {default: "", type: "string"},
    },
    strict: true,
  });

  if (values.repo === "") {
    console.error("Usage: bun run scripts/sync-labels.ts --repo OWNER/REPO [--dry-run]");
    process.exit(1);
  }

  const contents = await Bun.file(values.file).text();
  const labels = parseLabelsYaml(contents);

  const duplicates = findDuplicateNames(labels);
  if (duplicates.length > 0) {
    console.error(`Duplicate label names in ${values.file}: ${duplicates.join(", ")}`);
    process.exit(1);
  }

  for (const label of labels) {
    const command = buildLabelCommand({label, repo: values.repo});
    if (values["dry-run"]) {
      console.info(command.join(" "));
      continue;
    }

    const result = Bun.spawnSync(command);
    if (result.exitCode !== 0) {
      console.error(`Failed to apply label "${label.name}": ${result.stderr.toString()}`);
      process.exit(1);
    }
    console.info(`Applied ${label.name}`);
  }

  console.info(`${values["dry-run"] ? "Would apply" : "Applied"} ${labels.length} labels`);
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
