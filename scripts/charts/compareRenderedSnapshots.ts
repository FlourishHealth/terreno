#!/usr/bin/env bun
import {spawn} from "node:child_process";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {chromium} from "@playwright/test";

import {
  CHART_VISUAL_FIXTURES,
  CHART_VISUAL_GALLERY_TEST_ID,
  type ChartVisualFixtureId,
  chartVisualFixtureTestId,
} from "../../demo/chartVisual/fixtureCatalog.ts";
import {diffPngBuffers, isChartVisualMatch} from "./compareChartImages.ts";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const SNAPSHOT_DIR = join(REPO_ROOT, "demo/rendered-snapshots");
const OUTPUT_DIR = join(REPO_ROOT, "demo/chart-visual-output");
const DEFAULT_PORT = 8085;
const DEFAULT_BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;
const GALLERY_PATH = "/demo/chart-visual-gallery?embed=1";
const VIEWPORT = {height: 900, width: 1280};

interface FixtureReport {
  diffCount?: number;
  id: string;
  status: "match" | "mismatch" | "missing" | "error";
  message?: string;
}

const parseArgs = (argv: string[]): {only?: ChartVisualFixtureId; update: boolean} => {
  let update = false;
  let only: ChartVisualFixtureId | undefined;
  for (const arg of argv) {
    if (arg === "--update") {
      update = true;
      continue;
    }
    if (arg.startsWith("--only=")) {
      const id = arg.slice("--only=".length) as ChartVisualFixtureId;
      only = id;
    }
  }
  return {only, update};
};

const isServerUp = async (baseUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(baseUrl, {method: "GET"});
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
};

const waitForServer = async (baseUrl: string, timeoutMs: number): Promise<void> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isServerUp(baseUrl)) {
      return;
    }
    await Bun.sleep(1000);
  }
  throw new Error(`Demo web did not become ready at ${baseUrl} within ${timeoutMs}ms`);
};

const startDemoIfNeeded = async (baseUrl: string): Promise<{pid: number} | undefined> => {
  if (await isServerUp(baseUrl)) {
    return undefined;
  }
  const child = spawn("bun", ["run", "demo:web"], {
    cwd: REPO_ROOT,
    env: {...process.env, RCT_METRO_PORT: String(DEFAULT_PORT)},
    stdio: "inherit",
  });
  if (child.pid === undefined) {
    throw new Error("Failed to start bun run demo:web");
  }
  await waitForServer(baseUrl, 180_000);
  return {pid: child.pid};
};

const selectedFixtures = (only?: ChartVisualFixtureId) => {
  if (!only) {
    return [...CHART_VISUAL_FIXTURES];
  }
  const fixture = CHART_VISUAL_FIXTURES.find((entry) => entry.id === only);
  if (!fixture) {
    throw new Error(`Unknown fixture id: ${only}`);
  }
  return [fixture];
};

export const compareChartRenderedSnapshots = async ({
  argv = process.argv.slice(2),
}: {
  argv?: string[];
} = {}): Promise<{failed: number; reports: FixtureReport[]}> => {
  const {only, update} = parseArgs(argv);
  const baseUrl = process.env.CHART_VISUAL_BASE_URL ?? DEFAULT_BASE_URL;
  mkdirSync(SNAPSHOT_DIR, {recursive: true});
  mkdirSync(join(OUTPUT_DIR, "actual"), {recursive: true});
  mkdirSync(join(OUTPUT_DIR, "diff"), {recursive: true});

  const started = await startDemoIfNeeded(baseUrl);
  const browser = await chromium.launch({args: ["--disable-animations"]});
  const reports: FixtureReport[] = [];

  try {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: VIEWPORT,
    });
    await page.goto(`${baseUrl}${GALLERY_PATH}`, {timeout: 120_000, waitUntil: "networkidle"});
    await page.getByTestId(CHART_VISUAL_GALLERY_TEST_ID).waitFor({timeout: 60_000});
    await page.evaluate(async () => {
      await document.fonts.ready;
      const nodes = document.querySelectorAll("body *");
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }
        const style = window.getComputedStyle(node);
        if (style.position !== "fixed" && style.position !== "sticky") {
          continue;
        }
        node.style.setProperty("display", "none", "important");
      }
    });
    await Bun.sleep(250);

    for (const fixture of selectedFixtures(only)) {
      const locator = page.getByTestId(chartVisualFixtureTestId(fixture.id));
      await locator.scrollIntoViewIfNeeded();
      await locator
        .locator("svg")
        .first()
        .waitFor({state: "visible", timeout: 30_000})
        .catch(() => undefined);
      const actual = await locator.screenshot({animations: "disabled", type: "png"});
      const snapshotPath = join(SNAPSHOT_DIR, `${fixture.id}.png`);
      const actualPath = join(OUTPUT_DIR, "actual", `${fixture.id}.png`);
      writeFileSync(actualPath, actual);

      if (update || !existsSync(snapshotPath)) {
        writeFileSync(snapshotPath, actual);
        reports.push({
          id: fixture.id,
          message: update ? "updated rendered-snapshot" : "wrote missing rendered-snapshot",
          status: "match",
        });
        continue;
      }

      try {
        const expected = readFileSync(snapshotPath);
        const {diffPng, result} = diffPngBuffers({actual, expected});
        const pixelCount = result.width * result.height;
        if (isChartVisualMatch({diffCount: result.diffCount, pixelCount})) {
          reports.push({diffCount: result.diffCount, id: fixture.id, status: "match"});
          continue;
        }
        writeFileSync(join(OUTPUT_DIR, "diff", `${fixture.id}.png`), diffPng);
        reports.push({
          diffCount: result.diffCount,
          id: fixture.id,
          message: `${result.diffCount} pixels differ (${result.width}x${result.height})`,
          status: "mismatch",
        });
      } catch (error) {
        reports.push({
          id: fixture.id,
          message: error instanceof Error ? error.message : String(error),
          status: "error",
        });
      }
    }
  } finally {
    await browser.close();
    if (started?.pid !== undefined) {
      process.kill(started.pid);
    }
  }

  const failed = reports.filter((report) => report.status !== "match").length;
  writeFileSync(join(OUTPUT_DIR, "report.json"), `${JSON.stringify({failed, reports}, null, 2)}\n`);
  return {failed, reports};
};

if (import.meta.main) {
  const {failed, reports} = await compareChartRenderedSnapshots();
  for (const report of reports) {
    const prefix = report.status === "match" ? "ok" : report.status;
    console.info(`${prefix} ${report.id}${report.message ? ` — ${report.message}` : ""}`);
  }
  if (failed > 0) {
    console.error(
      `${failed} fixture(s) differed. Inspect demo/chart-visual-output and run the review-chart-visuals skill.`
    );
    process.exit(1);
  }
  console.info("Chart rendered-snapshots match.");
}
