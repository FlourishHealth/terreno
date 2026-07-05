/**
 * E2E suite for the @terreno/syncdb local-first data layer (Tasks 7.2/7.3/7.4,
 * acceptance criteria AC-1..AC-15 in docs/implementationPlans/syncdb-local-first.md).
 *
 * Flag mechanism: the suite toggles the backend "use-syncdb" feature flag at runtime
 * through the admin feature-flags API (see helpers/syncdbFlag.ts), creating the flag
 * when the database was never seeded. EXPO_PUBLIC_USE_SYNCDB is deliberately NOT used:
 * the Expo web server (and its env) is shared by every spec in the run, so baking the
 * override into the bundle would flip all other suites onto the syncdb path. The
 * flag-on describes enable the flag in beforeAll; the final describe verifies the
 * flag-off RTK path (AC-15) and leaves the flag disabled for any suites that follow.
 *
 * Offline simulation severs the network instead of using the dev panel's
 * `syncdb-offline-toggle`: the toggle stops the whole client (client.stop()), and a
 * stopped client throws from mutate() ("mutate() requires start() to have resolved an
 * authenticated user"), so queued-offline-mutation scenarios cannot run through it —
 * reported as a product bug. The tests instead abort HTTP requests to the backend and
 * sever/refuse the socket.io WebSocket via page.routeWebSocket, which is also a truer
 * outage: the client stays started, mutations queue in the durable outbox, and the
 * transport reports disconnected. API seeding from the test runner (simulating
 * "another client") is unaffected because only the page's requests are blocked.
 *
 * Note on clickable Boxes: @terreno/ui Box renders onClick pressables with a
 * "-clickable" testID suffix (Box.tsx), so `todo-toggle-{id}` / `sync-conflict-badge`
 * are addressed as `todo-toggle-{id}-clickable` / `sync-conflict-badge-clickable`,
 * matching the convention already used by todos.spec.ts.
 */
import type {Browser, BrowserContext, Page, WebSocketRoute} from "@playwright/test";
import type {ConsoleGuard} from "./fixtures/test";
import {expect, test} from "./fixtures/test";
import {SECOND_USER, TEST_USER} from "./fixtures/testUsers";
import {loginAs} from "./helpers/login";
import {setSyncDbFlag} from "./helpers/syncdbFlag";
import {clearTodosAs, createTodoAs, listTodosAs, patchTodoAs} from "./helpers/todosApi";

const SYNC_DB_NAME = "terreno-example";
const CONVERGE_TIMEOUT = 20_000;
const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Console noise expected while the network is severed and the client reconnects. */
const allowSyncDbNoise = (consoleGuard: ConsoleGuard): void => {
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

const todoItemByTitle = (page: Page, title: string) =>
  page.locator('[data-testid^="todo-item-"]').filter({hasText: title});

/**
 * Wait for the syncdb-backed Todos screen. The banner is asserted as *attached*
 * rather than visible: when sync is idle it renders no children, and Playwright
 * treats the resulting zero-size element as hidden.
 */
const waitForSyncTodosScreen = async (page: Page): Promise<void> => {
  await page.getByTestId("todos-screen").first().waitFor({state: "visible", timeout: 30_000});
  await page.getByTestId("sync-status-banner").waitFor({state: "attached", timeout: 30_000});
  await page.getByTestId("todos-title-input").waitFor({state: "visible"});
};

const openSyncTodos = async (page: Page): Promise<void> => {
  await page.goto("/");
  await waitForSyncTodosScreen(page);
};

/**
 * Network-level offline simulation. installOfflineControl must run before login so
 * the WebSocket route wraps every socket.io connection the page opens; goSyncOffline
 * then severs live sockets and refuses new connections + HTTP until goSyncOnline.
 * (The dev panel's syncdb-offline-toggle is not used: it stops the client outright,
 * and a stopped client cannot queue mutations — see the header note.)
 */
const offlinePages = new WeakSet<Page>();
const liveSockets = new WeakMap<Page, Set<WebSocketRoute>>();

const installOfflineControl = async (page: Page): Promise<void> => {
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

const goSyncOffline = async (page: Page): Promise<void> => {
  offlinePages.add(page);
  await page.route(`${API_URL}/**`, (route) => route.abort("connectionrefused"));
  for (const ws of liveSockets.get(page) ?? []) {
    ws.close();
  }
  await page.getByTestId("sync-offline-indicator").waitFor({state: "visible", timeout: 15_000});
};

const goSyncOnline = async (page: Page): Promise<void> => {
  offlinePages.delete(page);
  await page.unroute(`${API_URL}/**`);
  // socket.io retries with backoff (max 5s), so reconnect lands within a few seconds.
  await page.getByTestId("sync-offline-indicator").waitFor({state: "hidden", timeout: 30_000});
};

const createTodoViaUi = async (page: Page, title: string): Promise<void> => {
  await page.getByTestId("todos-title-input").fill(title);
  await page.getByTestId("todos-create-button").click();
  await todoItemByTitle(page, title).waitFor({state: "visible"});
};

/** Open a second logged-in browser session on the sync Todos screen. */
const openSecondSession = async (
  browser: Browser,
  user: {email: string; name: string; password: string} = TEST_USER
): Promise<{context: BrowserContext; page: Page}> => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, user);
  await openSyncTodos(page);
  return {context, page};
};

/** Byte length of the encrypted syncdb blob in IndexedDB (0 when absent). */
const readSyncDbBlobLength = async (page: Page): Promise<number> => {
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
const readAllStorageSerialized = async (
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

test.describe("SyncDB local-first load (AC-1)", () => {
  let seeded: Array<{_id: string; title: string}> = [];

  test.beforeAll(async () => {
    await setSyncDbFlag(true);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(TEST_USER);
    seeded = [];
    for (const title of ["Seeded one", "Seeded two", "Seeded three"]) {
      seeded.push(await createTodoAs(TEST_USER, title));
    }
    await loginAs(page);
    await openSyncTodos(page);
  });

  test("seeded server todos render from the local store after login", async ({page}) => {
    for (const todo of seeded) {
      await expect(page.getByTestId(`todo-item-${todo._id}`)).toBeVisible({
        timeout: CONVERGE_TIMEOUT,
      });
    }
    await expect(page.getByTestId("sync-status-banner")).toBeAttached();
    await expect(page.getByTestId("sync-queued-count")).toBeHidden();
    await expect(page.getByTestId("sync-offline-indicator")).toBeHidden();
  });
});

test.describe("SyncDB offline mutations (AC-4, AC-6)", () => {
  test.beforeAll(async () => {
    await setSyncDbFlag(true);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(TEST_USER);
    // Sentinel todo: waiting for a bootstrapped item proves syncDb.start() has
    // completed (the screen renders and accepts input before the client is ready).
    const sentinel = await createTodoAs(TEST_USER, "Pre-synced sentinel");
    await installOfflineControl(page);
    await loginAs(page);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${sentinel._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("offline create applies instantly, queues, and syncs on reconnect", async ({page}) => {
    await goSyncOffline(page);

    await page.getByTestId("todos-title-input").fill("Offline milk run");
    await page.getByTestId("todos-create-button").click();

    // Optimistic local apply — visible before any network round trip.
    await expect(todoItemByTitle(page, "Offline milk run")).toBeVisible();
    await expect(page.getByTestId("sync-queued-count")).toBeVisible();
    await expect(page.getByTestId("sync-queued-count")).toContainText("1");

    await goSyncOnline(page);

    // Queue drains and the todo survives (server-acked).
    await expect(page.getByTestId("sync-queued-count")).toBeHidden({timeout: CONVERGE_TIMEOUT});
    await expect(todoItemByTitle(page, "Offline milk run")).toBeVisible();
    await expect
      .poll(async () => (await listTodosAs(TEST_USER)).map((todo) => todo.title), {
        timeout: CONVERGE_TIMEOUT,
      })
      .toContain("Offline milk run");

    // The todo persists across a reload (re-hydrated locally, confirmed by server).
    await page.reload();
    await waitForSyncTodosScreen(page);
    await expect(todoItemByTitle(page, "Offline milk run")).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("offline toggle and delete apply locally and replay on reconnect", async ({page}) => {
    const toggled = await createTodoAs(TEST_USER, "Toggle me offline");
    const doomed = await createTodoAs(TEST_USER, "Delete me offline");
    await expect(page.getByTestId(`todo-item-${toggled._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
    await expect(page.getByTestId(`todo-item-${doomed._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });

    await goSyncOffline(page);

    // Toggle completion — the item moves to the Completed section immediately.
    await page.getByTestId(`todo-toggle-${toggled._id}-clickable`).click();
    await expect(page.getByTestId("todos-completed-section")).toBeVisible();
    await expect(
      page.getByTestId("todos-completed-section").getByTestId(`todo-item-${toggled._id}`)
    ).toBeVisible();

    // Delete — the item disappears immediately.
    await page.getByTestId(`todo-delete-${doomed._id}`).click();
    await expect(page.getByTestId(`todo-item-${doomed._id}`)).toBeHidden();

    await expect(page.getByTestId("sync-queued-count")).toContainText("2");

    await goSyncOnline(page);
    await expect(page.getByTestId("sync-queued-count")).toBeHidden({timeout: CONVERGE_TIMEOUT});

    // Server state converges: toggled todo completed, deleted todo gone.
    await expect
      .poll(
        async () => {
          const todos = await listTodosAs(TEST_USER);
          return {
            deletedGone: !todos.some((todo) => todo._id === doomed._id),
            toggledCompleted: todos.find((todo) => todo._id === toggled._id)?.completed ?? false,
          };
        },
        {timeout: CONVERGE_TIMEOUT}
      )
      .toEqual({deletedGone: true, toggledCompleted: true});

    // State also converges across a reload.
    await page.reload();
    await waitForSyncTodosScreen(page);
    await expect(
      page.getByTestId("todos-completed-section").getByTestId(`todo-item-${toggled._id}`)
    ).toBeVisible({timeout: CONVERGE_TIMEOUT});
    await expect(page.getByTestId(`todo-item-${doomed._id}`)).toBeHidden();
  });
});

test.describe("SyncDB live delta sync (AC-8)", () => {
  let sentinel: {_id: string};

  test.beforeAll(async () => {
    await setSyncDbFlag(true);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(TEST_USER);
    // Sentinel todo: rendering it proves each session's client finished starting.
    sentinel = await createTodoAs(TEST_USER, "Pre-synced sentinel");
    await loginAs(page);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${sentinel._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("a todo created in another session appears without reload", async ({page, browser}) => {
    const {context, page: pageB} = await openSecondSession(browser);
    try {
      // Wait for B's client to be fully started before mutating from it.
      await expect(pageB.getByTestId(`todo-item-${sentinel._id}`)).toBeVisible({
        timeout: CONVERGE_TIMEOUT,
      });
      await createTodoViaUi(pageB, "From the other tab");

      // Context A receives the change via sync:delta — no reload, no interaction.
      await expect(todoItemByTitle(page, "From the other tab")).toBeVisible({
        timeout: CONVERGE_TIMEOUT,
      });

      // Deleting it in B removes it from A live as well.
      const itemInB = todoItemByTitle(pageB, "From the other tab");
      const testId = (await itemInB.getAttribute("data-testid")) ?? "";
      const id = testId.replace("todo-item-", "");
      await pageB.getByTestId(`todo-delete-${id}`).click();
      await expect(todoItemByTitle(pageB, "From the other tab")).toBeHidden();
      await expect(todoItemByTitle(page, "From the other tab")).toBeHidden({
        timeout: CONVERGE_TIMEOUT,
      });
    } finally {
      await context.close();
    }
  });
});

test.describe("SyncDB conflict resolution (AC-10, AC-11, AC-12)", () => {
  let target: {_id: string; title: string};

  test.beforeAll(async () => {
    await setSyncDbFlag(true);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(TEST_USER);
    target = await createTodoAs(TEST_USER, "Conflict target");
    await installOfflineControl(page);
    await loginAs(page);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${target._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  /**
   * Builds the AC-10 state: an offline local edit (completion toggle — the only
   * update surface the sync Todos UI exposes) racing a concurrent server-side edit
   * (title change via the REST API, which bumps the doc's sync version).
   */
  const produceConflict = async (page: Page): Promise<void> => {
    await goSyncOffline(page);
    await page.getByTestId(`todo-toggle-${target._id}-clickable`).click();
    await expect(page.getByTestId("sync-queued-count")).toContainText("1");

    // "Another client" edits the same todo while we're offline.
    await patchTodoAs(TEST_USER, target._id, {title: "Server edit"});

    await goSyncOnline(page);
    await expect(page.getByTestId("sync-conflict-badge-clickable")).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  };

  test("conflict surfaces both versions; 'use server' resolves to the server value", async ({
    page,
  }) => {
    await produceConflict(page);

    await page.getByTestId("sync-conflict-badge-clickable").click();
    await expect(page.getByTestId("conflict-sheet")).toBeVisible();
    const conflictItem = page.getByTestId(`conflict-item-${target._id}`);
    await expect(conflictItem).toBeVisible();
    // Both versions render side by side: the local snapshot (still titled
    // "Conflict target") and the server version ("Server edit").
    await expect(conflictItem).toContainText("Conflict target");
    await expect(conflictItem).toContainText("Server edit");

    await page.getByTestId("conflict-use-server-button").click();

    await expect(page.getByTestId("sync-conflict-badge-clickable")).toBeHidden({
      timeout: CONVERGE_TIMEOUT,
    });
    // Local store now holds the server version: new title, still incomplete.
    await expect(page.getByTestId(`todo-item-${target._id}`)).toContainText("Server edit", {
      timeout: CONVERGE_TIMEOUT,
    });
    await expect(page.getByTestId("todos-completed-section")).toBeHidden();

    // No mutation was re-sent — the server keeps completed=false.
    const serverTodos = await listTodosAs(TEST_USER);
    const serverTodo = serverTodos.find((todo) => todo._id === target._id);
    expect(serverTodo?.completed).toBe(false);
    expect(serverTodo?.title).toBe("Server edit");
  });

  test("'keep mine' re-applies the local version to the server", async ({page}) => {
    await produceConflict(page);

    await page.getByTestId("sync-conflict-badge-clickable").click();
    await expect(page.getByTestId(`conflict-item-${target._id}`)).toBeVisible();
    await page.getByTestId("conflict-keep-mine-button").click();

    await expect(page.getByTestId("sync-conflict-badge-clickable")).toBeHidden({
      timeout: CONVERGE_TIMEOUT,
    });
    await expect(page.getByTestId("sync-queued-count")).toBeHidden({timeout: CONVERGE_TIMEOUT});

    // The local value (completed=true) wins on the server too; the concurrent
    // title edit is untouched because keep-mine re-applies only the local fields.
    await expect
      .poll(
        async () => {
          const todos = await listTodosAs(TEST_USER);
          const todo = todos.find((t) => t._id === target._id);
          return {completed: todo?.completed ?? false, title: todo?.title ?? ""};
        },
        {timeout: CONVERGE_TIMEOUT}
      )
      .toEqual({completed: true, title: "Server edit"});

    // Local UI reflects the win: the todo sits in the Completed section.
    await expect(
      page.getByTestId("todos-completed-section").getByTestId(`todo-item-${target._id}`)
    ).toBeVisible({timeout: CONVERGE_TIMEOUT});
  });
});

test.describe("SyncDB encryption at rest (AC-14)", () => {
  test.beforeAll(async () => {
    await setSyncDbFlag(true);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(TEST_USER);
    // Sentinel todo: rendering it proves syncDb.start() completed before we mutate.
    const sentinel = await createTodoAs(TEST_USER, "Pre-synced sentinel");
    await loginAs(page);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${sentinel._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("IndexedDB holds only ciphertext and the store decrypts after reload", async ({page}) => {
    // Wait for the persister's first (post-bootstrap) save so growth below can only
    // come from a save that snapshots the store after the marker todo exists.
    await expect
      .poll(() => readSyncDbBlobLength(page), {timeout: CONVERGE_TIMEOUT})
      .toBeGreaterThan(0);
    const baseline = await readSyncDbBlobLength(page);

    await createTodoViaUi(page, "SECRET_MARKER_XYZ");
    await expect(page.getByTestId("sync-queued-count")).toBeHidden({timeout: CONVERGE_TIMEOUT});

    // Wait out the debounced persister save (poll, no waitForTimeout).
    await expect
      .poll(() => readSyncDbBlobLength(page), {timeout: CONVERGE_TIMEOUT})
      .toBeGreaterThan(baseline);

    const storage = await readAllStorageSerialized(page);
    expect(storage.databases).toContain(SYNC_DB_NAME);
    expect(storage.serialized).not.toContain("SECRET_MARKER_XYZ");

    // Reload: the persisted blob decrypts and the todo renders with its title.
    await page.reload();
    await waitForSyncTodosScreen(page);
    await expect(todoItemByTitle(page, "SECRET_MARKER_XYZ")).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });
});

test.describe("SyncDB user switch wipe (AC-7)", () => {
  let seededForA: {_id: string; title: string};

  test.beforeAll(async () => {
    await setSyncDbFlag(true);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(TEST_USER);
    await clearTodosAs(SECOND_USER);
    seededForA = await createTodoAs(TEST_USER, "User A synced todo");
    await installOfflineControl(page);
    await loginAs(page);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${seededForA._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });

  test("logging in as another user wipes local data and the queued outbox", async ({page}) => {
    // Queue an offline mutation as user A.
    await goSyncOffline(page);
    await page.getByTestId("todos-title-input").fill("A queued secret");
    await page.getByTestId("todos-create-button").click();
    await expect(page.getByTestId("sync-queued-count")).toContainText("1");

    // Log out while still offline so the queued mutation cannot replay as A.
    // Navigate via the tab bar (client-side) — a full goto would reload the document
    // and re-evaluate the feature flag against the blocked network.
    await page.getByTestId("tab-profile").click();
    await page.getByTestId("profile-logout-button").waitFor({state: "visible", timeout: 15_000});
    await page.getByTestId("profile-logout-button").click();
    await page.getByTestId("login-screen").first().waitFor({state: "visible"});

    // Restore the network, then switch users. This scenario is inherently a mid-test
    // user switch, so loginAs is reused here rather than in beforeEach.
    offlinePages.delete(page);
    await page.unroute(`${API_URL}/**`);
    await loginAs(page, SECOND_USER);
    await openSyncTodos(page);

    // None of A's data or queued work is visible as B.
    await expect(page.getByTestId("todos-empty-state")).toBeVisible({timeout: CONVERGE_TIMEOUT});
    await expect(page.locator('[data-testid^="todo-item-"]')).toHaveCount(0);
    await expect(page.getByTestId("sync-queued-count")).toBeHidden();

    // A's queued create is never replayed under B's identity.
    const bTodos = await listTodosAs(SECOND_USER);
    expect(bTodos.some((todo) => todo.title === "A queued secret")).toBe(false);

    // Logging back in as A re-bootstraps A's server data.
    await page.goto("/profile");
    await page.getByTestId("profile-logout-button").waitFor({state: "visible"});
    await page.getByTestId("profile-logout-button").click();
    await page.getByTestId("login-screen").first().waitFor({state: "visible"});
    await loginAs(page, TEST_USER);
    await openSyncTodos(page);
    await expect(page.getByTestId(`todo-item-${seededForA._id}`)).toBeVisible({
      timeout: CONVERGE_TIMEOUT,
    });
  });
});

// Runs last: verifies the RTK path with the flag off (AC-15) and leaves the flag
// disabled so suites after this file keep the default behavior.
test.describe("SyncDB flag off leaves the RTK path unchanged (AC-15)", () => {
  test.beforeAll(async () => {
    await setSyncDbFlag(false);
  });

  test.beforeEach(async ({page, consoleGuard}) => {
    allowSyncDbNoise(consoleGuard);
    await clearTodosAs(TEST_USER);
    await loginAs(page);
    await page.goto("/");
    await page.getByTestId("todos-new-title-input").first().waitFor({state: "visible"});
  });

  test("RTK todos CRUD works and no syncdb UI renders", async ({page}) => {
    await expect(page.getByTestId("sync-status-banner")).toHaveCount(0);
    await expect(page.getByTestId("syncdb-dev-panel")).toHaveCount(0);

    // Create
    await page.getByTestId("todos-new-title-input").first().fill("RTK path todo");
    await page.getByTestId("todos-add-button").first().click();
    const item = page.locator('[data-testid^="todos-item-"]').filter({hasText: "RTK path todo"});
    await item.waitFor({state: "visible"});

    // Toggle
    const testId = (await item.getAttribute("data-testid")) ?? "";
    const id = testId.replace("todos-item-", "");
    await page.getByTestId(`todos-toggle-${id}-clickable`).first().click();
    await page.getByTestId("todos-completed-section-toggle-clickable").waitFor({state: "visible"});

    // Delete
    await page.getByTestId(`todos-delete-${id}`).first().click();
    await expect(page.getByTestId(`todos-item-${id}`)).toBeHidden({timeout: CONVERGE_TIMEOUT});
  });
});
