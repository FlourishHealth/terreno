import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {resolveTerrenoProjectRoot} from "../projectRoot.js";

interface LogEntry {
  level?: string;
  message?: unknown;
  timestamp?: string;
  source: string;
  raw: string;
}

const parseJsonlFile = (path: string, source: string, maxLines: number): LogEntry[] => {
  if (!existsSync(path)) {
    return [];
  }
  const text = readFileSync(path, "utf-8");
  const lines = text.split("\n").filter(Boolean);
  const slice = lines.slice(-maxLines);
  const out: LogEntry[] = [];
  for (const raw of slice) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      out.push({
        level: typeof obj.level === "string" ? obj.level : undefined,
        message: obj.message,
        raw,
        source,
        timestamp: typeof obj.timestamp === "string" ? obj.timestamp : undefined,
      });
    } catch {
      out.push({raw, source});
    }
  }
  return out;
};

export interface ReadLogsArgs {
  sources?: string[];
  entries?: number;
  level?: string;
}

export const readLogs = async (args: ReadLogsArgs): Promise<string> => {
  const root = resolveTerrenoProjectRoot();
  const maxEntries = Math.min(Math.max(args.entries ?? 200, 1), 2000);
  const want = (args.sources ?? ["backend", "browser", "metro", "app"]).map((s) => s.toLowerCase());
  const levelFilter = args.level?.toLowerCase();

  const backendPath = join(root, ".terreno", "logs", "app.log");
  const browserPath = join(root, ".terreno", "logs", "browser.log");

  const merged: LogEntry[] = [];

  if (want.includes("backend")) {
    merged.push(...parseJsonlFile(backendPath, "backend", maxEntries));
  }
  if (want.includes("browser")) {
    merged.push(...parseJsonlFile(browserPath, "browser", maxEntries));
  }
  if (want.includes("metro")) {
    merged.push({
      raw: "Metro bundler events require an active `/events` WebSocket connection (not attached in v1). Start Metro and use Expo MCP or extend terreno-mcp-local.",
      source: "metro",
    });
  }
  if (want.includes("app")) {
    merged.push({
      raw: "Hermes console capture requires a CDP connection to Metro (not attached in v1). Use Expo MCP `collect_app_logs` or enable future CDP support in terreno-mcp-local.",
      source: "app",
    });
  }

  const filtered = levelFilter
    ? merged.filter((e) => (e.level ?? "").toLowerCase() === levelFilter)
    : merged;

  return JSON.stringify({entries: filtered.slice(-maxEntries)}, null, 2);
};

export interface LastErrorArgs {
  sources?: string[];
}

export const lastError = async (args: LastErrorArgs): Promise<string> => {
  const root = resolveTerrenoProjectRoot();
  const want = (args.sources ?? ["backend", "browser"]).map((s) => s.toLowerCase());
  const paths: Array<{path: string; source: string}> = [];
  if (want.includes("backend")) {
    paths.push({path: join(root, ".terreno", "logs", "app.log"), source: "backend"});
  }
  if (want.includes("browser")) {
    paths.push({path: join(root, ".terreno", "logs", "browser.log"), source: "browser"});
  }

  let last: LogEntry | undefined;
  for (const {path, source} of paths) {
    if (!existsSync(path)) {
      continue;
    }
    const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const raw = lines[i] ?? "";
      try {
        const obj = JSON.parse(raw) as {level?: string};
        if ((obj.level ?? "").toLowerCase() === "error") {
          last = {level: "error", raw, source};
          break;
        }
      } catch {}
    }
    if (last) {
      break;
    }
  }

  if (!last) {
    return "No recent error-level JSONL entries in `.terreno/logs/app.log` or `.terreno/logs/browser.log`.";
  }
  return last.raw;
};
