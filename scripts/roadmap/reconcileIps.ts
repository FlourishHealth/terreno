/**
 * Reconciles the roadmap against the implementation plans and task files that
 * actually live in the repo, so merging an IP status change moves the board.
 *
 * The chain, left to right, each step with exactly one writer:
 *
 *   docs/implementationPlans/*.md  ──reconcileIps──▶  roadmap-seed-issues.md
 *   docs/tasks/*.md                (Status only)
 *                                                            │
 *                                                       roadmap:sync
 *                                                            ▼
 *                                                     Project board
 *                                                            │
 *                                                    roadmap:generate
 *                                                            ▼
 *                                                       ROADMAP.md
 *
 * An IP header owns `Status`. The seed document owns everything an IP does not
 * record (Area, Target, Impact, labels, the outside-reader summary). This script
 * only ever rewrites Status, and it reports — never guesses — the judgment calls:
 * a plan with no roadmap entry, an entry whose plan was deleted, or task
 * checkboxes that disagree with the declared status.
 *
 * Usage:
 *   bun run roadmap:reconcile            # report
 *   bun run roadmap:reconcile --check    # exit 1 on any finding (CI)
 *   bun run roadmap:reconcile --fix      # rewrite Status in the seed document
 */
import {readdirSync} from "node:fs";
import {parseArgs} from "node:util";

import {SEED_ISSUES_PATH, parseSeedIssues} from "./seedIssues.ts";

export const IP_DIRECTORY = "docs/implementationPlans";
export const TASKS_DIRECTORY = "docs/tasks";

/**
 * `IP_TEMPLATE.md` documents the canonical vocabulary as
 * `Draft | Approved | In progress | Complete | Deferred`; the rest are aliases
 * observed in real plans. Keys are matched longest-first against the lowercased
 * status prefix.
 */
export const IP_STATUS_TO_BOARD: Record<string, string> = {
  approved: "Planned",
  complete: "Shipped",
  deferred: "Declined",
  draft: "Shaping",
  implemented: "Shipped",
  "in progress": "In progress",
  "research complete": "Shipped",
  shaped: "Shaping",
  shaping: "Shaping",
  superseded: "Declined",
};

/** Files in the IP directory that are not implementation plans. */
const NON_PLAN_FILES = new Set(["IP_TEMPLATE.md", "README.md"]);

/**
 * Lifecycle order, used to keep automation monotonic. Status is advanced
 * automatically but never walked backwards: IP headers go stale far more often
 * than boards do — several plans still read "Draft" for work that shipped —
 * so a backwards move is reported as a stale header rather than applied.
 * `Declined` sits outside the ladder because superseding is always allowed.
 */
export const STATUS_RANK: Record<string, number> = {
  Inbox: 0,
  Shaping: 1,
  Planned: 2,
  "In progress": 3,
  "In review": 4,
  Shipped: 5,
};

export const DECLINED = "Declined";

export interface IpRecord {
  /** Board Status derived from the IP header, or null when unmappable. */
  boardStatus: string | null;
  /** `**Parent IP:**` slug, set when this plan rides on another plan's roadmap entry. */
  parentIp: string | null;
  /** Raw `**Status:**` text, or null when the header is absent. */
  rawStatus: string | null;
  roadmapIssue: number | null;
  slug: string;
  supersededBy: string | null;
}

export interface TaskProgress {
  done: number;
  /**
   * True when the task file declares `**Status:** Closed`. Closed lists record
   * that the IP finished by another route — the unexecuted boxes below are
   * history, not outstanding work — so their checkbox counts prove nothing.
   */
  isClosed: boolean;
  total: number;
}

export interface Finding {
  detail: string;
  /** Board Status the repo implies. Set only on `status-drift` findings. */
  expected?: string;
  /** `fix` findings are repaired by --fix; `review` findings need a human. */
  kind: "fix" | "review";
  slug: string;
  type: string;
}

const headerValue = ({contents, key}: {contents: string; key: string}): string | null => {
  const match = contents.match(new RegExp(`^\\*\\*${key}:\\*\\*\\s*(.+)$`, "m"));
  return match === null ? null : (match[1]?.trim() ?? null);
};

/**
 * Maps freeform status prose onto a board option. Real plans write things like
 * "Approved — decisions recorded (2026-07-29)", so only the leading phrase is
 * significant.
 */
export const toBoardStatus = (rawStatus: string | null): string | null => {
  if (rawStatus === null) {
    return null;
  }

  const prefix = rawStatus
    .toLowerCase()
    .split(/[—\-,|(]/)[0]
    ?.trim();
  if (prefix === undefined || prefix === "") {
    return null;
  }

  // Longest key first so "in progress" wins over nothing and "research
  // complete" wins over "complete".
  const keys = Object.keys(IP_STATUS_TO_BOARD).sort((left, right) => right.length - left.length);
  for (const key of keys) {
    if (prefix === key || prefix.startsWith(`${key} `)) {
      return IP_STATUS_TO_BOARD[key] ?? null;
    }
  }

  return null;
};

/**
 * Treats empty and italic `*(optional)*` placeholders as unset so a copied
 * template does not silence reconcile.
 */
export const parseParentIp = (raw: string | null): string | null => {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === "" || /^\*\(.*\)\*$/.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const parseIpRecord = ({contents, slug}: {contents: string; slug: string}): IpRecord => {
  const rawStatus = headerValue({contents, key: "Status"});
  const issueValue = headerValue({contents, key: "Roadmap issue"});
  const issueMatch = issueValue?.match(/\/issues\/(\d+)/) ?? null;

  return {
    boardStatus: toBoardStatus(rawStatus),
    parentIp: parseParentIp(headerValue({contents, key: "Parent IP"})),
    rawStatus,
    roadmapIssue: issueMatch === null ? null : Number.parseInt(issueMatch[1] ?? "", 10),
    slug,
    supersededBy: headerValue({contents, key: "Superseded by"}),
  };
};

export const parseTaskProgress = (contents: string): TaskProgress => {
  const boxes = contents.match(/^\s*-\s\[[ xX]\]/gm) ?? [];
  const done = contents.match(/^\s*-\s\[[xX]\]/gm) ?? [];
  const status = headerValue({contents, key: "Status"});
  return {
    done: done.length,
    isClosed: status !== null && status.toLowerCase().startsWith("closed"),
    total: boxes.length,
  };
};

/**
 * A sub-document that shares its parent IP's roadmap entry: either named by the
 * `-research` / `-design` convention or pointing at a parent explicitly with a
 * `**Parent IP:**` header.
 */
export const isSubDocument = ({parentIp, slug}: {parentIp?: string | null; slug: string}): boolean => {
  return /-(research|design)$/.test(slug) || (parentIp ?? null) !== null;
};

export const collectFindings = ({
  ips,
  seedStatuses,
  taskProgress,
}: {
  ips: IpRecord[];
  /** Board Status currently declared in the seed document, keyed by IP slug. */
  seedStatuses: Map<string, string>;
  taskProgress: Map<string, TaskProgress>;
}): Finding[] => {
  const findings: Finding[] = [];
  const ipSlugs = new Set(ips.map((ip) => ip.slug));

  for (const ip of ips) {
    if (isSubDocument({parentIp: ip.parentIp, slug: ip.slug})) {
      continue;
    }

    const seedStatus = seedStatuses.get(ip.slug);

    if (ip.boardStatus === null && ip.rawStatus !== null) {
      findings.push({
        detail: `Status "${ip.rawStatus}" does not map to a board option. Use one of: ${Object.keys(IP_STATUS_TO_BOARD).join(", ")}`,
        kind: "review",
        slug: ip.slug,
        type: "unmappable-status",
      });
      continue;
    }

    if (ip.boardStatus === null) {
      findings.push({
        detail: `No **Status:** header in ${IP_DIRECTORY}/${ip.slug}.md`,
        kind: "review",
        slug: ip.slug,
        type: "missing-status",
      });
      continue;
    }

    // A superseded plan is closed work no matter what its Status line says.
    const expected = ip.supersededBy === null ? ip.boardStatus : "Declined";

    if (seedStatus === undefined) {
      if (expected !== "Shaping") {
        findings.push({
          detail: `IP is "${ip.rawStatus}" (board: ${expected}) but has no entry in ${SEED_ISSUES_PATH}. Add one with Area/Target/Impact, then run roadmap:sync.`,
          kind: "review",
          slug: ip.slug,
          type: "missing-roadmap-entry",
        });
      }
      continue;
    }

    if (seedStatus !== expected) {
      const supersededNote = ip.supersededBy === null ? "" : ` (superseded by ${ip.supersededBy})`;
      const currentRank = STATUS_RANK[seedStatus] ?? -1;
      const expectedRank = STATUS_RANK[expected] ?? -1;
      // Declining is always allowed; reviving declined work is not. A plan whose
      // header still says "Approved" must not silently reopen a decision.
      const isForward = expected === DECLINED || (seedStatus !== DECLINED && expectedRank > currentRank);

      if (isForward) {
        findings.push({
          detail: `IP says "${ip.rawStatus}"${supersededNote} → ${expected}, roadmap says ${seedStatus}`,
          expected,
          kind: "fix",
          slug: ip.slug,
          type: expected === DECLINED ? "superseded" : "status-advanced",
        });
      } else if (seedStatus === DECLINED) {
        findings.push({
          detail: `Roadmap declined this, but the IP header reads "${ip.rawStatus}" (→ ${expected}). Reviving declined work is a maintainer decision — update the IP header or the roadmap entry by hand.`,
          kind: "review",
          slug: ip.slug,
          type: "declined-but-ip-open",
        });
      } else {
        findings.push({
          detail: `Roadmap says ${seedStatus} but the IP header still reads "${ip.rawStatus}" (→ ${expected}). The board is ahead; update the IP header.`,
          kind: "review",
          slug: ip.slug,
          type: "stale-ip-header",
        });
      }
    }

    const progress = taskProgress.get(ip.slug);
    if (progress !== undefined && progress.total > 0 && !progress.isClosed) {
      const allDone = progress.done === progress.total;
      if (allDone && expected !== "Shipped" && expected !== "Declined") {
        findings.push({
          detail: `All ${progress.total} tasks are checked but the IP is "${ip.rawStatus}". Mark it Complete, or explain what remains.`,
          kind: "review",
          slug: ip.slug,
          type: "tasks-done-ip-open",
        });
      }
      if (!allDone && expected === "Shipped") {
        findings.push({
          detail: `IP is "${ip.rawStatus}" but ${progress.total - progress.done} of ${progress.total} tasks are unchecked`,
          kind: "review",
          slug: ip.slug,
          type: "ip-shipped-tasks-open",
        });
      }
    }
  }

  for (const slug of seedStatuses.keys()) {
    if (!ipSlugs.has(slug)) {
      findings.push({
        detail: `${SEED_ISSUES_PATH} references IP "${slug}" but ${IP_DIRECTORY}/${slug}.md does not exist`,
        kind: "review",
        slug,
        type: "orphan-roadmap-entry",
      });
    }
  }

  return findings;
};

/**
 * Rewrites Status in both seed-document shapes: the `**Project fields:**` line
 * of a `##` section and the Status column of the backfill table. Only the
 * Status token changes; nothing else in the document is touched.
 */
export const applyStatusFixes = ({
  contents,
  fixes,
}: {
  contents: string;
  fixes: {slug: string; status: string}[];
}): string => {
  let updated = contents;

  for (const fix of fixes) {
    const escaped = fix.slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // `**Project fields:** ... IP=`<slug>`, Status=`<old>``
    updated = updated.replace(
      new RegExp(`(\\*\\*Project fields:\\*\\*[^\\n]*IP=\`${escaped}\`[^\\n]*Status=)\`[^\`]*\``),
      `$1\`${fix.status}\``
    );

    // `| `<slug>` | <url> | `<old>` | ...`
    updated = updated.replace(
      new RegExp(`(^\\| \`${escaped}\` \\| \\S+ \\| )\`[^\`]*\``, "m"),
      `$1\`${fix.status}\``
    );
  }

  return updated;
};

const readPlans = async (): Promise<IpRecord[]> => {
  const records: IpRecord[] = [];

  for (const file of readdirSync(IP_DIRECTORY)) {
    if (!file.endsWith(".md") || NON_PLAN_FILES.has(file)) {
      continue;
    }
    const slug = file.slice(0, -".md".length);
    records.push({
      ...parseIpRecord({contents: await Bun.file(`${IP_DIRECTORY}/${file}`).text(), slug}),
    });
  }

  return records;
};

const readTaskProgress = async (): Promise<Map<string, TaskProgress>> => {
  const progress = new Map<string, TaskProgress>();

  for (const file of readdirSync(TASKS_DIRECTORY)) {
    if (!file.endsWith(".md") || file === "README.md") {
      continue;
    }
    progress.set(
      file.slice(0, -".md".length),
      parseTaskProgress(await Bun.file(`${TASKS_DIRECTORY}/${file}`).text())
    );
  }

  return progress;
};

export const main = async (): Promise<void> => {
  const {values} = parseArgs({
    options: {
      check: {default: false, type: "boolean"},
      fix: {default: false, type: "boolean"},
    },
    strict: true,
  });

  const seedContents = await Bun.file(SEED_ISSUES_PATH).text();
  const seeds = parseSeedIssues(seedContents);
  const seedStatuses = new Map<string, string>();
  for (const seed of seeds) {
    if (seed.ip !== "" && seed.status !== "") {
      seedStatuses.set(seed.ip, seed.status);
    }
  }

  const ips = await readPlans();
  const taskProgress = await readTaskProgress();
  const findings = collectFindings({ips, seedStatuses, taskProgress});

  const fixable = findings.filter((finding) => finding.kind === "fix");
  const review = findings.filter((finding) => finding.kind === "review");

  console.info(`Scanned ${ips.length} implementation plans and ${taskProgress.size} task files.`);

  if (fixable.length > 0) {
    console.info(`\nStatus advances (${fixable.length}):`);
    for (const finding of fixable) {
      console.info(`  - ${finding.slug}: ${finding.detail}`);
    }
  }

  if (review.length > 0) {
    console.info(`\nNeeds a human (${review.length}):`);
    for (const finding of review) {
      console.info(`  - [${finding.type}] ${finding.slug}: ${finding.detail}`);
    }
  }

  if (findings.length === 0) {
    console.info("\nRoadmap matches the implementation plans.");
    return;
  }

  if (values.fix && fixable.length > 0) {
    const fixes = fixable.flatMap((finding) =>
      finding.expected === undefined ? [] : [{slug: finding.slug, status: finding.expected}]
    );
    const updated = applyStatusFixes({contents: seedContents, fixes});
    if (updated === seedContents) {
      console.error("\n--fix matched no Status values to rewrite; the seed document may have changed shape.");
      process.exit(1);
    }
    await Bun.write(SEED_ISSUES_PATH, updated);
    console.info(`\nRewrote ${fixes.length} Status values in ${SEED_ISSUES_PATH}. Run roadmap:sync next.`);
    if (review.length === 0) {
      return;
    }
  }

  if (values.check) {
    console.error(`\nroadmap:reconcile --check: ${findings.length} findings`);
    process.exit(1);
  }
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
