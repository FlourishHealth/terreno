import {appendFileSync, mkdirSync} from "node:fs";
import {join} from "node:path";
import type express from "express";
import {DateTime} from "luxon";

const shouldEnableBrowserLogs = (): boolean => {
  if (process.env.TERRENO_BROWSER_LOGS === "false" || process.env.TERRENO_BROWSER_LOGS === "0") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
};

interface BrowserLogPayload {
  level?: string;
  message?: unknown;
  stack?: string;
  timestamp?: string;
}

/**
 * Dev-only ingestion for the Terreno MCP `read_logs` tool: POST batches of client
 * console / global error lines as JSONL under `.terreno/logs/browser.log`.
 */
export const addTerrenoDevBrowserLogsRoute = (app: express.Application): void => {
  if (!shouldEnableBrowserLogs()) {
    return;
  }

  app.post("/__terreno/browser-logs", (req, res) => {
    const body = req.body as {entries?: unknown};
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      res.status(400).json({error: "Expected { entries: [...] }"});
      return;
    }

    const logDir = join(process.cwd(), ".terreno", "logs");
    mkdirSync(logDir, {recursive: true});
    const path = join(logDir, "browser.log");

    for (const row of body.entries) {
      if (typeof row !== "object" || row === null) {
        continue;
      }
      const r = row as BrowserLogPayload;
      const level = typeof r.level === "string" ? r.level : "info";
      const message =
        typeof r.message === "string" ? r.message : JSON.stringify(r.message ?? "").slice(0, 8000);
      const line = JSON.stringify({
        level,
        message,
        source: "browser",
        stack: typeof r.stack === "string" ? r.stack : undefined,
        timestamp:
          typeof r.timestamp === "string" && r.timestamp ? r.timestamp : DateTime.now().toISO(),
      });
      appendFileSync(path, `${line}\n`, {encoding: "utf-8", mode: 0o600});
    }

    res.status(204).end();
  });
};
