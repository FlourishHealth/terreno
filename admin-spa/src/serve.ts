import fs from "node:fs";
import path from "node:path";
import type {TerrenoPlugin} from "@terreno/api";
import {logger} from "@terreno/api";
import express from "express";
import {type AdminSpaAppConfig, resolveAppConfig} from "./appConfig";

// Compiled (CommonJS) file lives at src/dist/serve.js; the pre-built bundle lives at
// admin-spa/dist. `__dirname` is the CommonJS module-directory global.
const DIST_DIR = path.resolve(__dirname, "../../dist");

const NO_STORE = "no-store";

export interface AdminSpaServeOptions {
  /** Path the SPA is mounted at. Default: "/console". Non-breaking with the AdminApp `/admin` API. */
  basePath?: string;
  /** Runtime config served at `${basePath}/app-config.json`. Merged with defaults. */
  appConfig?: Partial<AdminSpaAppConfig>;
  /** Override the directory the pre-built bundle is served from (used by tests/custom builds). */
  distDir?: string;
  /**
   * In dev, proxy all SPA paths to a running `expo start --web` server, e.g.
   * "http://localhost:8083". Avoids re-running `expo export` per change.
   */
  devProxyTarget?: string;
}

/**
 * Rewrite the absolute `/_expo/` and `/assets/` references emitted by Expo's static
 * web export so a single pre-built bundle works when mounted at any `basePath`.
 */
export const rewriteIndexHtml = (rawIndex: string, basePath: string): string => {
  return rawIndex
    .replaceAll('href="/_expo/', `href="${basePath}/_expo/`)
    .replaceAll('src="/_expo/', `src="${basePath}/_expo/`)
    .replaceAll('href="/assets/', `href="${basePath}/assets/`)
    .replaceAll('src="/assets/', `src="${basePath}/assets/`);
};

/**
 * Inject `window.__ADMIN_SPA_BASE__` so the SPA can build absolute URLs (e.g.
 * `${base}/app-config.json`) regardless of the current deep route. Inserted before
 * `</head>` so it runs before the bundle.
 */
export const injectBaseGlobal = (html: string, basePath: string): string => {
  const script = `<script>window.__ADMIN_SPA_BASE__=${JSON.stringify(basePath)};</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }
  return script + html;
};

/**
 * Opt-in Express plugin that serves a pre-built admin SPA (Expo Router static export)
 * from the same Node process as a Terreno backend. Mounts at `/console` by default.
 *
 * @example
 * ```typescript
 * new TerrenoApp({userModel: User})
 *   .register(new BetterAuthApp({config, userModel: User}))
 *   .register(new AdminApp({models: [...]}))
 *   .register(new AdminSpaServeApp({basePath: "/console", appConfig: {brandName: "Acme"}}))
 *   .start();
 * ```
 */
export class AdminSpaServeApp implements TerrenoPlugin {
  constructor(private readonly opts: AdminSpaServeOptions = {}) {}

  register(app: express.Application): void {
    const basePath = this.opts.basePath ?? "/console";
    const distDir = this.opts.distDir ?? DIST_DIR;
    const appConfig = resolveAppConfig(this.opts.appConfig);

    // Dev proxy: forward SPA assets to `expo start --web`, but keep app-config on the plugin.
    if (this.opts.devProxyTarget) {
      // Register before the catch-all proxy so Express matches this route first.
      app.get(`${basePath}/app-config.json`, (_req, res) => {
        res.set("Cache-Control", NO_STORE).json(appConfig);
      });
      // Lazy require so production deploys without the dev dependency don't break.
      const {createProxyMiddleware} = require("http-proxy-middleware") as {
        createProxyMiddleware: (options: {
          changeOrigin: boolean;
          pathRewrite: Record<string, string>;
          target: string;
          ws: boolean;
        }) => express.RequestHandler;
      };
      app.use(
        basePath,
        createProxyMiddleware({
          changeOrigin: true,
          pathRewrite: {[`^${basePath}`]: ""},
          target: this.opts.devProxyTarget,
          ws: true,
        })
      );
      logger.info(`Admin SPA dev-proxied to ${this.opts.devProxyTarget} at ${basePath}/`);
      return;
    }

    // Read index.html once and rewrite absolute asset refs to the mounted basePath.
    const indexHtmlPath = path.join(distDir, "index.html");
    let indexHtml = "";
    try {
      indexHtml = injectBaseGlobal(
        rewriteIndexHtml(fs.readFileSync(indexHtmlPath, "utf-8"), basePath),
        basePath
      );
    } catch {
      logger.warn(
        `Admin SPA: no pre-built bundle found at ${indexHtmlPath}. ` +
          "Run `bun run --filter '@terreno/admin-spa' build:web` or set devProxyTarget."
      );
    }

    // 1. Hashed asset directories — long cache, immutable.
    const staticOpts = {immutable: true, maxAge: "365d"};
    app.use(`${basePath}/_expo`, express.static(path.join(distDir, "_expo"), staticOpts));
    app.use(`${basePath}/assets`, express.static(path.join(distDir, "assets"), staticOpts));

    // 2. Runtime config — never cached.
    app.get(`${basePath}/app-config.json`, (_req, res) => {
      res.set("Cache-Control", NO_STORE).json(appConfig);
    });

    // 3. SPA fallback. Two registrations: bare basePath (no trailing slash) AND splat,
    // matching the `/*name` Express 5 convention used elsewhere in the repo.
    const serveSpa = (_req: express.Request, res: express.Response): void => {
      res.set("Cache-Control", NO_STORE).type("html").send(indexHtml);
    };
    app.get(basePath, serveSpa);
    app.get(`${basePath}/*splat`, serveSpa);

    logger.info(`Admin SPA mounted at ${basePath}/`);
  }
}
