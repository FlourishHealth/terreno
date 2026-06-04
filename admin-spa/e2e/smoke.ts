import type {Server} from "node:http";
import {createTestApp} from "./serveTestApp";

/**
 * Backend-free smoke check: boots the SPA serve plugin over the pre-built `dist/`,
 * then asserts the key endpoints respond correctly. Run with `bun e2e/smoke.ts`
 * after `bun run build:web`. Exits non-zero on the first failed assertion so it can
 * gate CI without needing a browser, database, or full backend.
 */
const PORT = Number(process.env.PORT ?? 4111);
const BASE = `http://localhost:${PORT}`;

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const run = async (): Promise<void> => {
  const server: Server = await new Promise((resolve) => {
    const s = createTestApp().listen(PORT, () => resolve(s));
  });

  const checks: Check[] = [];
  try {
    const indexRes = await fetch(`${BASE}/console/`);
    const indexHtml = await indexRes.text();
    checks.push({
      detail: `status=${indexRes.status}`,
      name: "GET /console/ returns HTML",
      ok: indexRes.status === 200 && indexHtml.includes("<html"),
    });
    checks.push({
      detail: "looks for window.__ADMIN_SPA_BASE__",
      name: "index.html injects SPA base global",
      ok: indexHtml.includes('window.__ADMIN_SPA_BASE__="/console"'),
    });

    const entryMatch = indexHtml.match(/\/console\/_expo\/static\/js\/web\/entry-[^"]+\.js/);
    const entryUrl = entryMatch?.[0];
    const entryRes = entryUrl ? await fetch(`${BASE}${entryUrl}`) : undefined;
    checks.push({
      detail: `entry=${entryUrl ?? "MISSING"} status=${entryRes?.status ?? "n/a"}`,
      name: "JS bundle is served",
      ok: Boolean(entryRes && entryRes.status === 200),
    });

    const cfgRes = await fetch(`${BASE}/console/app-config.json`);
    const cfg = (await cfgRes.json()) as {brandName?: string; providers?: string[]};
    checks.push({
      detail: `status=${cfgRes.status} brand=${cfg.brandName}`,
      name: "app-config.json returns merged config",
      ok: cfgRes.status === 200 && cfg.brandName === "Terreno Admin (e2e)",
    });

    const deepRes = await fetch(`${BASE}/console/User/123`);
    checks.push({
      detail: `status=${deepRes.status}`,
      name: "deep route falls back to index.html",
      ok: deepRes.status === 200,
    });

    const outsideRes = await fetch(`${BASE}/unrelated`);
    checks.push({
      detail: `status=${outsideRes.status}`,
      name: "routes outside basePath are not handled (404)",
      ok: outsideRes.status === 404,
    });
  } finally {
    server.close();
  }

  let failed = false;
  for (const check of checks) {
    const symbol = check.ok ? "✅" : "❌";
    console.info(`${symbol} ${check.name} (${check.detail})`);
    if (!check.ok) {
      failed = true;
    }
  }

  if (failed) {
    console.error("admin-spa smoke check FAILED");
    process.exit(1);
  }
  console.info("admin-spa smoke check passed");
  process.exit(0);
};

void run();
