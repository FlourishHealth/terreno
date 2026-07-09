/**
 * Shared helpers for the @terreno/syncdb local-first e2e suite (Tasks 7.2/7.3/7.4,
 * acceptance criteria AC-1..AC-14 in docs/implementationPlans/syncdb-local-first.md).
 * The suite is split across the syncdb-*.spec.ts files so each file can run on its
 * own worker (and CI shard) with its own dedicated user.
 *
 * Offline simulation severs the network instead of using the dev panel's
 * `syncdb-offline-toggle` (which now uses the client's goOffline()/goOnline()
 * transport-level simulation). The tests abort HTTP requests to the backend and
 * sever/refuse the socket.io WebSocket via page.routeWebSocket, which is a truer
 * outage: the client stays started, mutations queue in the durable outbox, and the
 * transport reports disconnected. API seeding from the test runner (simulating
 * "another client") is unaffected because only the page's requests are blocked.
 *
 * Note on clickable Boxes: @terreno/ui Box renders onClick pressables with a
 * "-clickable" testID suffix (Box.tsx), so `todo-toggle-{id}` / `sync-conflict-badge`
 * are addressed as `todo-toggle-{id}-clickable` / `sync-conflict-badge-clickable`,
 * matching the convention already used by todos.spec.ts.
 */
import type {Browser, BrowserContext, Locator, Page, WebSocketRoute} from "@playwright/test";
import type {ConsoleGuard} from "../fixtures/test";
import type {E2EUser} from "../fixtures/testUsers";
import {loginAs} from "./login";

export const SYNC_DB_NAME = "terreno-example";
export const CONVERGE_TIMEOUT = 20_000;

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Console noise expected while the network is severed and the client reconnects. */
export const allowSyncDbNoise = (consoleGuard: ConsoleGuard): void => {
  consoleGuard.allow(/\[syncdb\]/);
  consoleGuard.allow(/\[sync\]/);
  consoleGuard.allow(/WebSocket/i);
  consoleGuard.allow(/websocket error/i);
  consoleGuard.allow(/socket\.io/i);
  consoleGuard.allow("Failed to load resource");
  consoleGuard.allow("Sentry not initialized");
  consoleGuard.allow("[useConsentForms] Failed to fetch pending consent forms");
  consoleGuard.allow("[ConsentNavigator] Error fetching pending consents");
  consoleGuard.allow("rejected mutation: Network unavailable");
  consoleGuard.allow("rejected query");
  consoleGuard.allow("Error fetching OpenAPI spec");
};

export const todoItemByTitle = (page: Page, title: string): Locator =>
  page.locator('[data-testid^="todo-item-"]').filter({hasText: title});

/**
 * Wait for the syncdb-backed Todos screen. The banner is asserted as *attached*
 * rather than visible: when sync is idle it renders no children, and Playwright
 * treats the resulting zero-size element as hidden.
 */
export const waitForSyncTodosScreen = async (page: Page): Promise<void> => {
  await page.getByTestId("todos-screen").first().waitFor({state: "visible", timeout: 30_000});
  await page.getByTestId("sync-status-banner").waitFor({state: "attached", timeout: 30_000});
  await page.getByTestId("todos-title-input").waitFor({state: "visible"});
};

export const openSyncTodos = async (page: Page): Promise<void> => {
  await page.goto("/");
  await waitForSyncTodosScreen(page);
};

/**
 * Network-level offline simulation. installOfflineControl must run before login so
 * the WebSocket route wraps every socket.io connection the page opens; goSyncOffline
 * then severs live sockets and refuses new connections + HTTP until goSyncOnline.
 * (The dev panel's syncdb-offline-toggle is not used: these tests exercise a real
 * network outage rather than the client's built-in simulation — see the header note.)
 */
const offlinePages = new WeakSet<Page>();
const liveSockets = new WeakMap<Page, Set<WebSocketRoute>>();

export const installOfflineControl = async (page: Page): Promise<void> => {
  liveSockets.set(page, new Set());
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    if (offlinePages.has(page)) {
      ws.close();
      return;
    }
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => ws.send(message));
    const sockets = liveSockets.get(page);
    sockets?.add(ws);
    ws.onClose(() => sockets?.delete(ws));
  });
};

export const goSyncOffline = async (page: Page): Promise<void> => {
  offlinePages.add(page);
  await page.route(`${API_URL}/**`, (route) => route.abort("connectionrefused"));
  for (const ws of liveSockets.get(page) ?? []) {
    ws.close();
  }
  await page.getByTestId("sync-offline-indicator").waitFor({state: "visible", timeout: 15_000});
};

export const goSyncOnline = async (page: Page): Promise<void> => {
  offlinePages.delete(page);
  await page.unroute(`${API_URL}/**`);
  // socket.io retries with backoff (max 5s), so reconnect lands within a few seconds.
  await page.getByTestId("sync-offline-indicator").waitFor({state: "hidden", timeout: 30_000});
};

/**
 * Restore the network without waiting for the reconnect indicator — used when the
 * page is mid user-switch and the sync UI is not mounted.
 */
export const restoreNetwork = async (page: Page): Promise<void> => {
  offlinePages.delete(page);
  await page.unroute(`${API_URL}/**`);
};

export const createTodoViaUi = async (page: Page, title: string): Promise<void> => {
  await page.getByTestId("todos-title-input").fill(title);
  await page.getByTestId("todos-create-button").click();
  await todoItemByTitle(page, title).waitFor({state: "visible"});
};

/** Open a second logged-in browser session on the sync Todos screen. */
export const openSecondSession = async (
  browser: Browser,
  user: E2EUser
): Promise<{context: BrowserContext; page: Page}> => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, user);
  await openSyncTodos(page);
  return {context, page};
};

/** Byte length of the encrypted syncdb blob in IndexedDB (0 when absent). */
export const readSyncDbBlobLength = async (page: Page): Promise<number> => {
  return page.evaluate(async (databaseName: string) => {
    const openDb = (): Promise<IDBDatabase | null> =>
      new Promise((resolve) => {
        const req = indexedDB.open(databaseName);
        req.onsuccess = (): void => resolve(req.result);
        req.onerror = (): void => resolve(null);
      });
    const db = await openDb();
    if (!db) {
      return 0;
    }
    try {
      if (!Array.from(db.objectStoreNames).includes("kv")) {
        return 0;
      }
      const value: unknown = await new Promise((resolve, reject) => {
        const tx = db.transaction("kv", "readonly");
        const rq = tx.objectStore("kv").get("content");
        rq.onsuccess = (): void => resolve(rq.result);
        rq.onerror = (): void => reject(rq.error);
      });
      if (value instanceof Uint8Array) {
        return value.byteLength;
      }
      if (value instanceof ArrayBuffer) {
        return value.byteLength;
      }
      return 0;
    } finally {
      db.close();
    }
  }, SYNC_DB_NAME);
};

/**
 * Serialize the raw contents of every IndexedDB database (binary payloads decoded
 * byte-per-char so any plaintext substring would surface) plus localStorage.
 */
export const readAllStorageSerialized = async (
  page: Page
): Promise<{databases: string[]; serialized: string}> => {
  return page.evaluate(async () => {
    const bytesToString = (bytes: Uint8Array): string => {
      let out = "";
      for (let i = 0; i < bytes.length; i++) {
        out += String.fromCharCode(bytes[i]);
      }
      return out;
    };
    const serializeValue = (value: unknown): string => {
      if (value instanceof Uint8Array) {
        return bytesToString(value);
      }
      if (value instanceof ArrayBuffer) {
        return bytesToString(new Uint8Array(value));
      }
      if (ArrayBuffer.isView(value)) {
        return bytesToString(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      }
      if (value && typeof value === "object") {
        const parts: string[] = [];
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
          parts.push(key, serializeValue(nested));
        }
        return parts.join("|");
      }
      try {
        return JSON.stringify(value) ?? String(value);
      } catch {
        return String(value);
      }
    };

    const names: string[] = [];
    let serialized = "";
    const infos = await indexedDB.databases();
    for (const info of infos) {
      if (!info.name) {
        continue;
      }
      names.push(info.name);
      const db: IDBDatabase | null = await new Promise((resolve) => {
        const req = indexedDB.open(info.name as string);
        req.onsuccess = (): void => resolve(req.result);
        req.onerror = (): void => resolve(null);
      });
      if (!db) {
        continue;
      }
      try {
        for (const storeName of Array.from(db.objectStoreNames)) {
          const records: unknown[] = await new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly");
            const rq = tx.objectStore(storeName).getAll();
            rq.onsuccess = (): void => resolve(rq.result as unknown[]);
            rq.onerror = (): void => reject(rq.error);
          });
          for (const record of records) {
            serialized += serializeValue(record);
          }
        }
      } finally {
        db.close();
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        serialized += `${key}|${localStorage.getItem(key) ?? ""}`;
      }
    }
    return {databases: names, serialized};
  });
};
