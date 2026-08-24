import assert from "node:assert/strict";
import {describe, it} from "bun:test";

import {
  type IpRecord,
  applyStatusFixes,
  collectFindings,
  isSubDocument,
  parseIpRecord,
  parseTaskProgress,
  toBoardStatus,
} from "./reconcileIps.ts";

const ip = (overrides: Partial<IpRecord> & {slug: string}): IpRecord => ({
  boardStatus: null,
  rawStatus: null,
  roadmapIssue: null,
  supersededBy: null,
  ...overrides,
});

describe("toBoardStatus", () => {
  it("maps the canonical vocabulary", () => {
    assert.equal(toBoardStatus("Draft"), "Shaping");
    assert.equal(toBoardStatus("Approved"), "Planned");
    assert.equal(toBoardStatus("In progress"), "In progress");
    assert.equal(toBoardStatus("Complete"), "Shipped");
    assert.equal(toBoardStatus("Deferred"), "Declined");
  });

  it("ignores the trailing prose real plans carry", () => {
    assert.equal(toBoardStatus("Approved — decisions recorded (2026-07-29)"), "Planned");
    assert.equal(toBoardStatus("Draft — blocked on PR #869"), "Shaping");
    assert.equal(toBoardStatus("Complete — phases 1–6 shipped in PR #932"), "Shipped");
    assert.equal(toBoardStatus("Shaped, ready for review"), "Shaping");
  });

  it("is case insensitive", () => {
    assert.equal(toBoardStatus("In Progress"), "In progress");
  });

  it("prefers the longer key so research complete does not read as complete", () => {
    assert.equal(toBoardStatus("Research complete — decisions recorded"), "Shipped");
  });

  it("returns null for prose it cannot map", () => {
    assert.equal(toBoardStatus("Percolating"), null);
    assert.equal(toBoardStatus(null), null);
  });
});

describe("parseIpRecord", () => {
  it("reads the header block", () => {
    const record = parseIpRecord({
      contents: [
        "# Implementation Plan: Thing",
        "",
        "**Status:** Approved — decisions 2026-08-20",
        "**Roadmap issue:** https://github.com/FlourishHealth/terreno/issues/1018",
        "**Superseded by:** [other](other.md)",
      ].join("\n"),
      slug: "thing",
    });

    assert.equal(record.boardStatus, "Planned");
    assert.equal(record.roadmapIssue, 1018);
    assert.equal(record.supersededBy, "[other](other.md)");
  });

  it("tolerates a plan with no header block", () => {
    const record = parseIpRecord({contents: "# Just a title\n\nProse.", slug: "bare"});
    assert.equal(record.rawStatus, null);
    assert.equal(record.boardStatus, null);
    assert.equal(record.roadmapIssue, null);
  });
});

describe("parseTaskProgress", () => {
  it("counts checked and total boxes, including nested ones", () => {
    const progress = parseTaskProgress(
      ["- [x] one", "- [ ] two", "  - [X] nested", "- not a task", "* [x] wrong bullet"].join("\n")
    );
    assert.deepEqual(progress, {done: 2, total: 3});
  });

  it("reports zero for a file with no checkboxes", () => {
    assert.deepEqual(parseTaskProgress("# Tasks\n\nProse only."), {done: 0, total: 0});
  });
});

describe("isSubDocument", () => {
  it("recognizes research and design sub-documents", () => {
    assert.equal(isSubDocument("infra-mcp-research"), true);
    assert.equal(isSubDocument("syncdb-phase-c-design"), true);
    assert.equal(isSubDocument("infra-mcp"), false);
  });
});

describe("collectFindings", () => {
  const noTasks = new Map();

  it("advances status when the IP is ahead of the roadmap", () => {
    const findings = collectFindings({
      ips: [ip({boardStatus: "Shipped", rawStatus: "Complete", slug: "a"})],
      seedStatuses: new Map([["a", "Planned"]]),
      taskProgress: noTasks,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.kind, "fix");
    assert.equal(findings[0]?.type, "status-advanced");
    assert.equal(findings[0]?.expected, "Shipped");
  });

  it("never walks status backwards — a stale IP header is reported, not applied", () => {
    const findings = collectFindings({
      ips: [ip({boardStatus: "Shaping", rawStatus: "Draft", slug: "a"})],
      seedStatuses: new Map([["a", "Shipped"]]),
      taskProgress: noTasks,
    });
    assert.equal(findings[0]?.kind, "review");
    assert.equal(findings[0]?.type, "stale-ip-header");
  });

  it("declines a superseded plan regardless of its Status line", () => {
    const findings = collectFindings({
      ips: [
        ip({boardStatus: "Planned", rawStatus: "Approved", slug: "a", supersededBy: "[b](b.md)"}),
      ],
      seedStatuses: new Map([["a", "Planned"]]),
      taskProgress: noTasks,
    });
    assert.equal(findings[0]?.kind, "fix");
    assert.equal(findings[0]?.type, "superseded");
    assert.equal(findings[0]?.expected, "Declined");
  });

  it("refuses to revive declined work automatically", () => {
    const findings = collectFindings({
      ips: [ip({boardStatus: "Planned", rawStatus: "Approved", slug: "a"})],
      seedStatuses: new Map([["a", "Declined"]]),
      taskProgress: noTasks,
    });
    assert.equal(findings[0]?.kind, "review");
    assert.equal(findings[0]?.type, "declined-but-ip-open");
  });

  it("flags an approved plan that has no roadmap entry", () => {
    const findings = collectFindings({
      ips: [ip({boardStatus: "Planned", rawStatus: "Approved", slug: "a"})],
      seedStatuses: new Map(),
      taskProgress: noTasks,
    });
    assert.equal(findings[0]?.type, "missing-roadmap-entry");
  });

  it("stays quiet about a draft plan with no roadmap entry", () => {
    const findings = collectFindings({
      ips: [ip({boardStatus: "Shaping", rawStatus: "Draft", slug: "a"})],
      seedStatuses: new Map(),
      taskProgress: noTasks,
    });
    assert.deepEqual(findings, []);
  });

  it("flags a roadmap entry whose plan was deleted", () => {
    const findings = collectFindings({
      ips: [],
      seedStatuses: new Map([["ghost", "Planned"]]),
      taskProgress: noTasks,
    });
    assert.equal(findings[0]?.type, "orphan-roadmap-entry");
  });

  it("flags fully checked tasks on an open plan", () => {
    const findings = collectFindings({
      ips: [ip({boardStatus: "In progress", rawStatus: "In progress", slug: "a"})],
      seedStatuses: new Map([["a", "In progress"]]),
      taskProgress: new Map([["a", {done: 5, total: 5}]]),
    });
    assert.equal(findings[0]?.type, "tasks-done-ip-open");
  });

  it("flags a shipped plan with unfinished tasks", () => {
    const findings = collectFindings({
      ips: [ip({boardStatus: "Shipped", rawStatus: "Complete", slug: "a"})],
      seedStatuses: new Map([["a", "Shipped"]]),
      taskProgress: new Map([["a", {done: 2, total: 5}]]),
    });
    assert.equal(findings[0]?.type, "ip-shipped-tasks-open");
  });

  it("skips research sub-documents, which share the parent's entry", () => {
    const findings = collectFindings({
      ips: [ip({boardStatus: "Shipped", rawStatus: "Research complete", slug: "a-research"})],
      seedStatuses: new Map(),
      taskProgress: noTasks,
    });
    assert.deepEqual(findings, []);
  });

  it("reports an unmappable status instead of guessing", () => {
    const findings = collectFindings({
      ips: [ip({rawStatus: "Percolating", slug: "a"})],
      seedStatuses: new Map([["a", "Planned"]]),
      taskProgress: noTasks,
    });
    assert.equal(findings[0]?.type, "unmappable-status");
  });
});

describe("applyStatusFixes", () => {
  it("rewrites the Status of a section without touching its other fields", () => {
    const before =
      "**Project fields:** Area=`api`, Target=`Next`, Impact=`Feature`, IP=`alpha`, Status=`Planned`";
    const after = applyStatusFixes({contents: before, fixes: [{slug: "alpha", status: "Shipped"}]});
    assert.equal(
      after,
      "**Project fields:** Area=`api`, Target=`Next`, Impact=`Feature`, IP=`alpha`, Status=`Shipped`"
    );
  });

  it("rewrites the Status column of a table row", () => {
    const before =
      "| `alpha` | https://github.com/o/r/issues/1 | `Planned` | `api` | `Next` | `Feature` | `type:feature` |";
    const after = applyStatusFixes({contents: before, fixes: [{slug: "alpha", status: "Shipped"}]});
    assert.ok(after.includes("| `Shipped` | `api` |"));
    assert.ok(after.includes("`type:feature`"));
  });

  it("leaves a slug that is a prefix of another alone", () => {
    const before = [
      "**Project fields:** IP=`comms-abstraction`, Status=`Planned`",
      "**Project fields:** IP=`comms-abstraction-research`, Status=`Planned`",
    ].join("\n");
    const after = applyStatusFixes({
      contents: before,
      fixes: [{slug: "comms-abstraction", status: "Shipped"}],
    });
    assert.ok(after.includes("IP=`comms-abstraction`, Status=`Shipped`"));
    assert.ok(after.includes("IP=`comms-abstraction-research`, Status=`Planned`"));
  });

  it("returns the input unchanged when no slug matches", () => {
    const before = "**Project fields:** IP=`alpha`, Status=`Planned`";
    assert.equal(applyStatusFixes({contents: before, fixes: [{slug: "beta", status: "Shipped"}]}), before);
  });
});
