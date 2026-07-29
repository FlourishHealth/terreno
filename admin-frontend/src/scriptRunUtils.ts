import type {IconName} from "@terreno/ui";
import {DateTime} from "luxon";
import type {BackgroundTask, ScriptRun} from "./types";

export type TaskStatus = BackgroundTask["status"];

export interface StatusMeta {
  badgeStatus: "info" | "error" | "warning" | "success" | "neutral";
  iconName: IconName;
  label: string;
}

/** Visual treatment for a task status, shared by the list, history, and modal. */
export const statusMeta = (status?: TaskStatus): StatusMeta => {
  switch (status) {
    case "completed":
      return {badgeStatus: "success", iconName: "circle-check", label: "Completed"};
    case "failed":
      return {badgeStatus: "error", iconName: "circle-xmark", label: "Failed"};
    case "cancelled":
      return {badgeStatus: "warning", iconName: "circle-exclamation", label: "Cancelled"};
    case "running":
      return {badgeStatus: "info", iconName: "spinner", label: "Running"};
    default:
      return {badgeStatus: "neutral", iconName: "clock", label: "Pending"};
  }
};

/** Compact relative time (e.g. "just now", "5m ago", "yesterday", "Jun 3"). */
export const relativeTime = (iso?: string): string => {
  if (!iso) {
    return "";
  }
  const then = DateTime.fromISO(iso);
  if (!then.isValid) {
    return "";
  }
  const totalSeconds = Math.max(1, Math.floor(DateTime.now().diff(then).as("seconds")));
  if (totalSeconds < 90) {
    return "just now";
  }
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "yesterday";
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  return then.toLocaleString({day: "numeric", month: "short"});
};

/** Human duration between two ISO timestamps (e.g. "8s", "3m 4s"). */
export const formatDuration = (startIso?: string, endIso?: string): string => {
  if (!startIso || !endIso) {
    return "";
  }
  const start = DateTime.fromISO(startIso);
  const end = DateTime.fromISO(endIso);
  if (!start.isValid || !end.isValid) {
    return "";
  }
  const seconds = Math.max(0, Math.round(end.diff(start).as("seconds")));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

const ERROR_PATTERN =
  /(error|exception|❌)|\b(fail|failed|failure|cannot|unable|invalid|denied)\b/i;

/** Heuristic: does an output line read like an error? Used to color/filter result rows. */
export const isErrorLine = (line: string): boolean => ERROR_PATTERN.test(line);

export interface OutputSummary {
  errorCount: number;
  successCount: number;
  total: number;
}

/**
 * Derive success/error counts for a task. The backend returns `result: string[]`
 * plus structured `logs`, so error count prefers `error`-level logs and falls back
 * to a per-line heuristic over the result strings.
 */
export const summarizeOutput = (task?: Partial<BackgroundTask> | null): OutputSummary => {
  const result = task?.result ?? [];
  const errorLogs = (task?.logs ?? []).filter((log) => log.level === "error").length;
  const heuristicErrors = result.filter(isErrorLine).length;
  const errorCount = Math.max(errorLogs, heuristicErrors);
  const total = result.length;
  return {
    errorCount: Math.min(errorCount, total || errorCount),
    successCount: Math.max(0, total - Math.min(errorCount, total)),
    total,
  };
};

/** Short, monospace-friendly id suffix for display (e.g. "…a1b2c3"). */
export const shortId = (id?: string): string => {
  if (!id) {
    return "";
  }
  return id.length <= 6 ? id : id.slice(-6);
};

/** Build the CSV/JSON payload for exporting a run's output lines. */
export const buildExport = (
  lines: string[],
  kind: "csv" | "json"
): {content: string; mimeType: string} => {
  if (kind === "json") {
    const rows = lines.map((line, index) => ({
      line: index + 1,
      result: line,
      status: isErrorLine(line) ? "error" : "success",
    }));
    return {content: JSON.stringify(rows, null, 2), mimeType: "application/json"};
  }
  const escapeCsv = (value: string): string => `"${String(value).replace(/"/g, '""')}"`;
  const head = "line,status,result\n";
  const body = lines
    .map((line, index) =>
      [String(index + 1), isErrorLine(line) ? "error" : "success", line].map(escapeCsv).join(",")
    )
    .join("\n");
  return {content: head + body, mimeType: "text/csv"};
};

/** Most-recent run per script name, keyed by `taskType`. */
export const latestRunByScript = (runs: ScriptRun[]): Record<string, ScriptRun> => {
  const latest: Record<string, ScriptRun> = {};
  for (const run of runs) {
    const existing = latest[run.taskType];
    if (!existing || (run.created ?? "") > (existing.created ?? "")) {
      latest[run.taskType] = run;
    }
  }
  return latest;
};
