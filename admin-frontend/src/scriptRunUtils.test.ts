import {describe, expect, it} from "bun:test";
import {DateTime} from "luxon";
import {
  buildExport,
  formatDuration,
  isErrorLine,
  latestRunByScript,
  relativeTime,
  shortId,
  statusMeta,
  summarizeOutput,
} from "./scriptRunUtils";
import type {ScriptRun} from "./types";

const makeRun = (overrides: Partial<ScriptRun>): ScriptRun => ({
  _id: "id",
  created: DateTime.now().toISO() ?? "",
  isDryRun: true,
  logs: [],
  status: "completed",
  taskType: "demo",
  updated: DateTime.now().toISO() ?? "",
  ...overrides,
});

describe("scriptRunUtils", () => {
  describe("statusMeta", () => {
    it("maps each status to a badge style", () => {
      expect(statusMeta("completed").badgeStatus).toBe("success");
      expect(statusMeta("failed").badgeStatus).toBe("error");
      expect(statusMeta("cancelled").badgeStatus).toBe("warning");
      expect(statusMeta("running").badgeStatus).toBe("info");
      expect(statusMeta("pending").badgeStatus).toBe("neutral");
      expect(statusMeta(undefined).label).toBe("Pending");
    });
  });

  describe("relativeTime", () => {
    it("returns empty for missing or invalid input", () => {
      expect(relativeTime(undefined)).toBe("");
      expect(relativeTime("not-a-date")).toBe("");
    });

    it("formats recent times", () => {
      expect(relativeTime(DateTime.now().toISO() ?? "")).toBe("just now");
      expect(relativeTime(DateTime.now().minus({minutes: 5}).toISO() ?? "")).toBe("5m ago");
      expect(relativeTime(DateTime.now().minus({hours: 3}).toISO() ?? "")).toBe("3h ago");
      expect(relativeTime(DateTime.now().minus({days: 1}).toISO() ?? "")).toBe("yesterday");
      expect(relativeTime(DateTime.now().minus({days: 3}).toISO() ?? "")).toBe("3d ago");
    });
  });

  describe("formatDuration", () => {
    it("returns empty when either timestamp is missing", () => {
      expect(formatDuration(undefined, undefined)).toBe("");
      expect(formatDuration("2026-01-01T00:00:00.000Z", undefined)).toBe("");
    });

    it("formats seconds and minutes", () => {
      const start = "2026-01-01T00:00:00.000Z";
      expect(formatDuration(start, "2026-01-01T00:00:08.000Z")).toBe("8s");
      expect(formatDuration(start, "2026-01-01T00:03:04.000Z")).toBe("3m 4s");
    });
  });

  describe("isErrorLine", () => {
    it("detects error-ish output lines", () => {
      expect(isErrorLine("Failed to update document abc")).toBe(true);
      expect(isErrorLine("ValidationError: required field")).toBe(true);
      expect(isErrorLine("Created 5 records")).toBe(false);
    });
  });

  describe("summarizeOutput", () => {
    it("counts errors from error-level logs", () => {
      const summary = summarizeOutput({
        logs: [
          {level: "info", message: "ok", timestamp: ""},
          {level: "error", message: "boom", timestamp: ""},
        ],
        result: ["one", "two", "three"],
      });
      expect(summary.total).toBe(3);
      expect(summary.errorCount).toBe(1);
      expect(summary.successCount).toBe(2);
    });

    it("falls back to a per-line heuristic when no error logs exist", () => {
      const summary = summarizeOutput({
        logs: [],
        result: ["Created record", "Failed to migrate record"],
      });
      expect(summary.errorCount).toBe(1);
      expect(summary.successCount).toBe(1);
    });

    it("handles empty/undefined tasks", () => {
      expect(summarizeOutput(undefined).total).toBe(0);
      expect(summarizeOutput(null).errorCount).toBe(0);
    });
  });

  describe("shortId", () => {
    it("returns the last 6 characters", () => {
      expect(shortId("507f1f77bcf86cd799439011")).toBe("439011");
      expect(shortId("abc")).toBe("abc");
      expect(shortId(undefined)).toBe("");
    });
  });

  describe("buildExport", () => {
    it("builds JSON with status classification", () => {
      const {content, mimeType} = buildExport(["ok line", "error line"], "json");
      const parsed = JSON.parse(content) as {line: number; result: string; status: string}[];
      expect(mimeType).toBe("application/json");
      expect(parsed).toHaveLength(2);
      expect(parsed[1].status).toBe("error");
    });

    it("builds CSV with a header and escaped quotes", () => {
      const {content, mimeType} = buildExport(['has "quote"'], "csv");
      expect(mimeType).toBe("text/csv");
      expect(content.startsWith("line,status,result\n")).toBe(true);
      expect(content).toContain('""quote""');
    });
  });

  describe("latestRunByScript", () => {
    it("keeps only the newest run per script", () => {
      const older = makeRun({
        _id: "1",
        created: "2026-01-01T00:00:00.000Z",
        taskType: "alpha",
      });
      const newer = makeRun({
        _id: "2",
        created: "2026-02-01T00:00:00.000Z",
        taskType: "alpha",
      });
      const other = makeRun({_id: "3", taskType: "beta"});
      const latest = latestRunByScript([older, newer, other]);
      expect(latest.alpha._id).toBe("2");
      expect(latest.beta._id).toBe("3");
    });
  });
});
