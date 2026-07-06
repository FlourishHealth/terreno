import path from "node:path";
import express from "express";
import {DateTime} from "luxon";
import {AdminSpaServeApp} from "../src/serve";
import {E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_NEEDS_SETUP_COOKIE} from "./credentials";

// Pre-built bundle lives at admin-spa/dist. Resolved explicitly (rather than relying on
// the plugin's compiled-location default) so the e2e works when run from TS source.
const DIST_DIR = path.resolve(__dirname, "../dist");

const SESSION_COOKIE = "admin_spa_e2e_session";
const SESSION_TOKEN = "admin-spa-e2e-session-token";

const E2E_ADMIN_USER = {
  createdAt: DateTime.fromISO("2026-01-01T00:00:00Z").toISO(),
  email: E2E_ADMIN_EMAIL,
  emailVerified: true,
  id: "admin-spa-e2e-user-id",
  name: "Admin E2E",
  updatedAt: DateTime.fromISO("2026-01-01T00:00:00Z").toISO(),
};

// Minimal admin config matching @terreno/admin-backend's /admin/config response shape,
// enough for AdminGate (200 = admin) and AdminHome (slot widgets) to render.
const ADMIN_CONFIG = {
  customScreens: [],
  home: {
    slots: {
      main: ["modelsGrid"],
    },
    title: "Admin",
  },
  models: [
    {
      defaultSort: "-created",
      displayName: "Todos",
      fields: {
        completed: {required: false, type: "boolean"},
        title: {required: true, type: "string"},
      },
      listFields: ["title", "completed"],
      name: "Todo",
      routePath: "/admin/todos",
    },
    {
      defaultSort: "-created",
      displayName: "Users",
      fields: {
        admin: {required: false, type: "boolean"},
        email: {required: true, type: "string"},
      },
      listFields: ["email", "admin"],
      name: "User",
      routePath: "/admin/users",
    },
  ],
};

const hasSession = (req: express.Request): boolean => {
  return (req.headers.cookie ?? "").includes(`${SESSION_COOKIE}=${SESSION_TOKEN}`);
};

/**
 * Minimal Express app that serves the pre-built admin SPA via `AdminSpaServeApp`,
 * plus an in-memory mock of the better-auth endpoints the SPA's login flow uses
 * (`/api/auth/sign-in/email`, `/api/auth/get-session`) and the admin metadata
 * endpoint (`/admin/config`). No database or real backend is required, so the
 * Playwright e2e can exercise the full anonymous -> login -> admin home
 * flow against the static bundle. Used by the smoke check and Playwright e2e.
 */
export const createTestApp = (): express.Express => {
  const app = express();
  app.use(express.json());

  // Mock better-auth email sign-in: valid credentials set a session cookie.
  app.post("/api/auth/sign-in/email", (req, res) => {
    const {email, password} = req.body ?? {};
    if (email !== E2E_ADMIN_EMAIL || password !== E2E_ADMIN_PASSWORD) {
      res.status(401).json({
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      });
      return;
    }
    res.cookie(SESSION_COOKIE, SESSION_TOKEN, {httpOnly: true, path: "/", sameSite: "lax"});
    res.json({redirect: false, token: SESSION_TOKEN, user: E2E_ADMIN_USER});
  });

  // Mock better-auth session lookup: returns the session for the cookie, else null.
  app.get("/api/auth/get-session", (req, res) => {
    if (!hasSession(req)) {
      res.json(null);
      return;
    }
    res.json({
      session: {
        expiresAt: DateTime.now().plus({days: 7}).toISO(),
        id: "admin-spa-e2e-session-id",
        token: SESSION_TOKEN,
        userId: E2E_ADMIN_USER.id,
      },
      user: E2E_ADMIN_USER,
    });
  });

  // Mock better-auth email sign-up: any new email/name/password succeeds and sets a
  // session cookie, mirroring the real Better Auth flow the setup screen relies on.
  app.post("/api/auth/sign-up/email", (req, res) => {
    const {email, name} = req.body ?? {};
    res.cookie(SESSION_COOKIE, SESSION_TOKEN, {httpOnly: true, path: "/", sameSite: "lax"});
    res.json({
      redirect: false,
      token: SESSION_TOKEN,
      user: {
        ...E2E_ADMIN_USER,
        email: email ?? E2E_ADMIN_USER.email,
        name: name ?? E2E_ADMIN_USER.name,
      },
    });
  });

  // Mock better-auth sign-out: clears the session cookie.
  app.post("/api/auth/sign-out", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, {path: "/"});
    res.json({success: true});
  });

  // Mock admin metadata endpoint: 200 for the signed-in admin, 401 otherwise
  // (AdminGate treats 200 as "admin" and 401 as "logged out").
  app.get("/admin/config", (req, res) => {
    if (!hasSession(req)) {
      res.status(401).json({title: "Not authenticated"});
      return;
    }
    res.json(ADMIN_CONFIG);
  });

  // Mock the first-admin setup flow exposed by AdminApp's `firstAdminSetup` option.
  // `needsSetup` is driven entirely by the per-context E2E_NEEDS_SETUP_COOKIE (set by
  // the spec via `page.context().addCookies`) so parallel test workers sharing this
  // server never interfere with each other.
  app.get("/admin/setup-status", (req, res) => {
    const needsSetup = (req.headers.cookie ?? "").includes(`${E2E_NEEDS_SETUP_COOKIE}=1`);
    res.json({needsSetup});
  });
  app.post("/admin/setup-claim", (req, res) => {
    if (!hasSession(req)) {
      res.status(401).json({title: "Sign in before claiming admin access"});
      return;
    }
    res.clearCookie(E2E_NEEDS_SETUP_COOKIE, {path: "/"}).json({admin: true});
  });

  const plugin = new AdminSpaServeApp({
    appConfig: {
      brandName: "Terreno Admin (e2e)",
      primaryColor: "#2563EB",
      providers: ["email", "google"],
    },
    basePath: "/console",
    distDir: DIST_DIR,
  });
  plugin.register(app);
  return app;
};

// Run directly (e.g. `bun e2e/serveTestApp.ts`) to start the server for Playwright.
if (import.meta.main) {
  const port = Number(process.env.PORT ?? 4100);
  createTestApp().listen(port, () => {
    console.info(`[admin-spa e2e] serving SPA at http://localhost:${port}/console/`);
  });
}
