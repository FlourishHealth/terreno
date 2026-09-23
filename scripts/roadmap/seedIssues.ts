/**
 * Parses `docs/explanation/roadmap-seed-issues.md` into structured roadmap
 * entries so the board can be seeded and re-synced from repo data instead of
 * hand-copied field values.
 *
 * Two shapes live in that document and both are parsed here:
 *
 * 1. An `## <slug>` section carrying `**Title:**`, `**Labels:**`, and
 *    `**Project fields:**` lines followed by the issue body. These are the
 *    authoritative entries.
 * 2. The trailing "Shipped, umbrella, and declined IPs" table, which names an
 *    already-open issue per IP slug together with its field values.
 */

import {ROADMAP_LABEL} from "./checkRoadmapItem.ts";

export interface SeedIssue {
  /** Board `Area` single-select value. */
  area: string;
  /** Issue body markdown, or null for table-sourced entries (issue exists already). */
  body: string | null;
  /** Board `Impact` single-select value. */
  impact: string;
  /** Slug for the board `IP` text field. Empty string when no IP exists yet. */
  ip: string;
  /** Existing issue number when the document names one, else null. */
  issueNumber: number | null;
  labels: string[];
  /** Heading slug, used only for diagnostics. */
  slug: string;
  /** Board `Status` single-select value. */
  status: string;
  /** Board `Target` single-select value. */
  target: string;
  title: string;
}

export const SEED_ISSUES_PATH = "docs/explanation/roadmap-seed-issues.md";

const METADATA_LINE = /^\*\*(?:Title|Labels|Project fields):\*\*/;

/**
 * The `roadmap` label is what makes the board's items filterable in the issue
 * list, so it is added here rather than repeated on every `**Labels:**` line.
 */
const withRoadmapLabel = (labels: string[]): string[] => {
  return labels.includes(ROADMAP_LABEL) ? labels : [...labels, ROADMAP_LABEL];
};

/** Pulls every `` `value` `` out of a metadata line. */
const backtickValues = (line: string): string[] => {
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? "");
};

/**
 * Reads `Area=`x`, Target=`y`, ...` into a map. `*(not yet written)*` and other
 * non-backticked values resolve to an empty string, which the board stores as
 * an empty IP field.
 */
export const parseProjectFields = (line: string): Record<string, string> => {
  const fields: Record<string, string> = {};
  for (const match of line.matchAll(/(\w+)=(?:`([^`]*)`|\*\(([^)]*)\)\*)/g)) {
    fields[match[1] ?? ""] = match[2] ?? "";
  }
  return fields;
};

const issueNumberFromUrl = (url: string): number | null => {
  const match = url.match(/\/issues\/(\d+)/);
  if (match === null) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseSection = (args: {body: string; slug: string}): SeedIssue | null => {
  const lines = args.body.split("\n");
  const titleLine = lines.find((line) => line.startsWith("**Title:**"));
  const fieldsLine = lines.find((line) => line.startsWith("**Project fields:**"));
  if (titleLine === undefined || fieldsLine === undefined) {
    return null;
  }

  const labelsLine = lines.find((line) => line.startsWith("**Labels:**"));
  const fields = parseProjectFields(fieldsLine);

  return {
    area: fields.Area ?? "",
    body: lines
      .filter((line) => !METADATA_LINE.test(line))
      .join("\n")
      .trim(),
    impact: fields.Impact ?? "",
    ip: fields.IP ?? "",
    issueNumber: null,
    labels: withRoadmapLabel(labelsLine === undefined ? [] : backtickValues(labelsLine)),
    slug: args.slug,
    status: fields.Status ?? "",
    target: fields.Target ?? "",
    title: backtickValues(titleLine)[0] ?? "",
  };
};

/**
 * Parses the trailing table. Rows name an existing issue, so no body is
 * produced — the sync only needs to place them on the board.
 */
export const parseBackfillTable = (contents: string): SeedIssue[] => {
  const rows: SeedIssue[] = [];

  for (const line of contents.split("\n")) {
    if (!line.startsWith("| `")) {
      continue;
    }

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 7) {
      continue;
    }

    const [slugCell, urlCell, statusCell, areaCell, targetCell, impactCell, typeCell] = cells;
    const issueNumber = issueNumberFromUrl(urlCell ?? "");
    if (issueNumber === null) {
      continue;
    }

    const slug = backtickValues(slugCell ?? "")[0] ?? "";
    const area = backtickValues(areaCell ?? "")[0] ?? "";
    rows.push({
      area,
      body: null,
      impact: backtickValues(impactCell ?? "")[0] ?? "",
      ip: slug,
      issueNumber,
      labels: withRoadmapLabel(
        [`area:${area}`, backtickValues(typeCell ?? "")[0] ?? ""].filter((label) => label !== "")
      ),
      slug,
      status: backtickValues(statusCell ?? "")[0] ?? "",
      target: backtickValues(targetCell ?? "")[0] ?? "",
      title: "",
    });
  }

  return rows;
};

export const parseSeedIssues = (contents: string): SeedIssue[] => {
  const issues: SeedIssue[] = [];
  const sections = contents.split(/^## /m).slice(1);

  for (const section of sections) {
    const newlineIndex = section.indexOf("\n");
    const slug = (newlineIndex === -1 ? section : section.slice(0, newlineIndex)).trim();
    const rest = newlineIndex === -1 ? "" : section.slice(newlineIndex + 1);
    const h1Index = rest.search(/\n# /);
    const body = h1Index === -1 ? rest : rest.slice(0, h1Index);
    const parsed = parseSection({body, slug});
    if (parsed !== null) {
      issues.push(parsed);
    }
  }

  return [...issues, ...parseBackfillTable(contents)];
};

export const readSeedIssues = async (path = SEED_ISSUES_PATH): Promise<SeedIssue[]> => {
  return parseSeedIssues(await Bun.file(path).text());
};
