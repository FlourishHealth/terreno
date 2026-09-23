/**
 * Validates a proposed roadmap item's labels and Project field values against
 * the repository's own taxonomy, so an agent or maintainer can check a plan
 * before touching GitHub.
 *
 * Labels come from `.github/labels.yml`; Status/Target/Impact options come from
 * `.github/roadmap-fields.yml`; Area options are derived from the `area:*`
 * labels rather than listed twice.
 */
import {parseArgs} from "node:util";

export interface RoadmapFieldOptions {
  areas: string[];
  impact: string[];
  status: string[];
  target: string[];
}

export interface ProposedRoadmapItem {
  area?: string;
  impact?: string;
  labels: string[];
  status?: string;
  target?: string;
}

export const LABELS_PATH = ".github/labels.yml";
export const FIELDS_PATH = ".github/roadmap-fields.yml";

/**
 * Every roadmap tracking issue carries this label. It replaces the old
 * `[Roadmap] ` title prefix: a label filters (`gh issue list --label roadmap`,
 * `label:roadmap` in the GitHub UI) where a title prefix only decorates.
 */
export const ROADMAP_LABEL = "roadmap";

export const parseLabelNames = (contents: string): string[] => {
  const parsed = Bun.YAML.parse(contents);
  if (!Array.isArray(parsed)) {
    throw new Error(`${LABELS_PATH} must contain a top-level list of labels`);
  }
  return parsed.map((entry) => String((entry as {name?: unknown}).name ?? ""));
};

export const deriveAreas = (labelNames: string[]): string[] => {
  return labelNames
    .filter((name) => name.startsWith("area:"))
    .map((name) => name.slice("area:".length));
};

export const parseFieldOptions = (args: {
  fieldsContents: string;
  labelNames: string[];
}): RoadmapFieldOptions => {
  const parsed = Bun.YAML.parse(args.fieldsContents) as Record<string, unknown>;

  const readList = (key: string): string[] => {
    const value = parsed[key];
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`${FIELDS_PATH} is missing a non-empty "${key}" list`);
    }
    return value.map((entry) => String(entry));
  };

  return {
    areas: deriveAreas(args.labelNames),
    impact: readList("impact"),
    status: readList("status"),
    target: readList("target"),
  };
};

const countPrefixed = (labels: string[], prefix: string): string[] => {
  return labels.filter((label) => label.startsWith(prefix));
};

/**
 * Returns a human-readable problem per rule violation. An empty array means the
 * item is safe to create.
 */
export const validateRoadmapItem = (args: {
  item: ProposedRoadmapItem;
  knownLabels: string[];
  options: RoadmapFieldOptions;
  /**
   * Require the `roadmap` label. On for anything headed to the board; off for
   * plain triage, where most issues are labelled but never tracked publicly.
   */
  requireRoadmapLabel?: boolean;
}): string[] => {
  const {item, knownLabels, options, requireRoadmapLabel = false} = args;
  const problems: string[] = [];

  for (const label of item.labels) {
    if (!knownLabels.includes(label)) {
      problems.push(`Label "${label}" is not defined in ${LABELS_PATH}`);
    }
  }

  if (requireRoadmapLabel && !item.labels.includes(ROADMAP_LABEL)) {
    problems.push(`Needs the "${ROADMAP_LABEL}" label so board items can be filtered in the issue list`);
  }

  const areaLabels = countPrefixed(item.labels, "area:");
  if (areaLabels.length === 0) {
    problems.push(`Needs exactly one area:* label. Options: ${options.areas.join(", ")}`);
  }
  if (areaLabels.length > 1) {
    problems.push(`Has ${areaLabels.length} area:* labels (${areaLabels.join(", ")}); use exactly one`);
  }

  const typeLabels = countPrefixed(item.labels, "type:");
  if (typeLabels.length === 0) {
    problems.push("Needs exactly one type:* label");
  }
  if (typeLabels.length > 1) {
    problems.push(`Has ${typeLabels.length} type:* labels (${typeLabels.join(", ")}); use exactly one`);
  }

  const checkOption = (label: string, value: string | undefined, allowed: string[]): void => {
    if (value === undefined) {
      return;
    }
    if (!allowed.includes(value)) {
      problems.push(`${label} "${value}" is not a Project option. Options: ${allowed.join(", ")}`);
    }
  };

  checkOption("Status", item.status, options.status);
  checkOption("Target", item.target, options.target);
  checkOption("Impact", item.impact, options.impact);
  checkOption("Area", item.area, options.areas);

  // The board's Area field and the issue's area:* label describe the same
  // thing, so a mismatch means one of the two views is wrong.
  if (item.area !== undefined && areaLabels.length === 1) {
    const labelArea = areaLabels[0]?.slice("area:".length);
    if (labelArea !== item.area) {
      problems.push(`Area field "${item.area}" does not match label "area:${labelArea}"`);
    }
  }

  return problems;
};

export const main = async (): Promise<void> => {
  const {values} = parseArgs({
    options: {
      area: {default: "", type: "string"},
      impact: {default: "", type: "string"},
      labels: {default: "", type: "string"},
      "on-board": {default: false, type: "boolean"},
      status: {default: "", type: "string"},
      target: {default: "", type: "string"},
    },
    strict: true,
  });

  const labelNames = parseLabelNames(await Bun.file(LABELS_PATH).text());
  const options = parseFieldOptions({
    fieldsContents: await Bun.file(FIELDS_PATH).text(),
    labelNames,
  });

  const labels = values.labels
    .split(",")
    .map((label) => label.trim())
    .filter((label) => label !== "");

  if (labels.length === 0) {
    console.error(
      'Usage: bun run roadmap:check --labels "area:api,type:feature" [--on-board] [--status Planned] [--target Next] [--impact Feature] [--area api]'
    );
    console.error("");
    console.error("--on-board also requires the `roadmap` label, which every board item carries.");
    console.error("");
    console.error(`Areas:  ${options.areas.join(", ")}`);
    console.error(`Status: ${options.status.join(", ")}`);
    console.error(`Target: ${options.target.join(", ")}`);
    console.error(`Impact: ${options.impact.join(", ")}`);
    process.exit(1);
  }

  const problems = validateRoadmapItem({
    item: {
      area: values.area === "" ? undefined : values.area,
      impact: values.impact === "" ? undefined : values.impact,
      labels,
      status: values.status === "" ? undefined : values.status,
      target: values.target === "" ? undefined : values.target,
    },
    knownLabels: labelNames,
    options,
    requireRoadmapLabel: values["on-board"],
  });

  if (problems.length > 0) {
    console.error("Roadmap item is not valid:");
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }

  console.info("Roadmap item looks valid.");
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
