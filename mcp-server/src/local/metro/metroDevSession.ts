import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";

import {resolveTerrenoProjectRoot} from "../projectRoot.js";

const RING_MAX = 2000;

interface RingEntry {
  level?: string;
  raw: string;
  source: string;
  timestamp?: string;
}

const cdpConsoleRing: RingEntry[] = [];
const metroEventsRing: RingEntry[] = [];

let cdpWs: WebSocket | undefined;
let metroWs: WebSocket | undefined;
let nextCdpId = 1;
const pendingCdp = new Map<number, {reject: (e: Error) => void; resolve: (v: unknown) => void}>();
let cdpConnectPromise: Promise<void> | undefined;
let lastCdpStatus = "not connected";
let metroEventsStatus = "not connected";

const pushRing = (ring: RingEntry[], entry: RingEntry): void => {
  ring.push(entry);
  if (ring.length > RING_MAX) {
    ring.splice(0, ring.length - RING_MAX);
  }
};

const mapConsoleTypeToLevel = (t: string): string => {
  const x = t.toLowerCase();
  if (x === "warning") {
    return "warn";
  }
  if (x === "log" || x === "info" || x === "debug" || x === "table" || x === "dir") {
    return x === "debug" ? "debug" : "info";
  }
  if (x === "error" || x === "assert") {
    return "error";
  }
  return "info";
};

const stringifyConsoleArgs = (args: unknown[]): string => {
  const parts: string[] = [];
  for (const a of args) {
    if (a && typeof a === "object") {
      const o = a as Record<string, unknown>;
      const v = o.value ?? o.description ?? o.unserializableValue;
      parts.push(typeof v === "string" ? v : JSON.stringify(a));
    } else {
      parts.push(String(a));
    }
  }
  return parts.join(" ");
};

export const resolveMetroHttpBase = (): string => {
  const env = process.env.TERRENO_METRO_URL?.trim();
  if (env) {
    return env.replace(/\/$/, "");
  }
  const root = resolveTerrenoProjectRoot();
  const pkgPath = join(root, "frontend", "package.json");
  if (!existsSync(pkgPath)) {
    return "http://localhost:8082";
  }
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as {scripts?: Record<string, string>};
    const start = pkg.scripts?.start ?? pkg.scripts?.web ?? "";
    const m = /--port\s+(\d+)/.exec(start);
    if (m?.[1]) {
      return `http://localhost:${m[1]}`;
    }
  } catch {
    // fall through
  }
  return "http://localhost:8082";
};

const httpToWsBase = (httpBase: string): string => {
  const u = new URL(httpBase);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}`;
};

const pickDebugTarget = (
  targets: Array<Record<string, unknown>>
): Record<string, unknown> | undefined => {
  const withWs = targets.filter((t) => typeof t.webSocketDebuggerUrl === "string");
  const hermes = withWs.find((t) =>
    String(t.title ?? "")
      .toLowerCase()
      .includes("hermes")
  );
  if (hermes) {
    return hermes;
  }
  const rn = withWs.find((t) =>
    String(t.description ?? "")
      .toLowerCase()
      .includes("react native")
  );
  if (rn) {
    return rn;
  }
  return withWs[0];
};

const handleCdpMessage = (text: string): void => {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return;
  }
  if (typeof msg.id === "number" && pendingCdp.has(msg.id)) {
    const entry = pendingCdp.get(msg.id);
    if (!entry) {
      return;
    }
    const {reject, resolve} = entry;
    pendingCdp.delete(msg.id);
    if (msg.error && typeof msg.error === "object") {
      const errObj = msg.error as {message?: string};
      reject(new Error(errObj.message ?? JSON.stringify(msg.error)));
      return;
    }
    resolve(msg);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    const params = msg.params as Record<string, unknown> | undefined;
    const type = typeof params?.type === "string" ? params.type : "log";
    const args = Array.isArray(params?.args) ? (params?.args as unknown[]) : [];
    const level = mapConsoleTypeToLevel(type);
    const message = stringifyConsoleArgs(args);
    const stackTrace = params?.stackTrace as {callFrames?: unknown[]} | undefined;
    const stack =
      stackTrace?.callFrames && stackTrace.callFrames.length > 0
        ? JSON.stringify(stackTrace.callFrames.slice(0, 8))
        : undefined;
    const line = JSON.stringify({
      level,
      message,
      source: "app",
      stack,
      timestamp: new Date().toISOString(),
    });
    pushRing(cdpConsoleRing, {
      level,
      raw: line,
      source: "app",
      timestamp: new Date().toISOString(),
    });
  }
};

const sendCdp = (method: string, params?: Record<string, unknown>): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    if (!cdpWs || cdpWs.readyState !== WebSocket.OPEN) {
      reject(new Error("CDP socket not open"));
      return;
    }
    const id = nextCdpId;
    nextCdpId += 1;
    pendingCdp.set(id, {reject, resolve});
    const payload = JSON.stringify({id, method, params: params ?? {}});
    cdpWs.send(payload);
    setTimeout(() => {
      if (pendingCdp.has(id)) {
        pendingCdp.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 8000);
  });
};

export const ensureCdpConnected = async (): Promise<{ok: boolean; detail: string}> => {
  if (cdpWs && cdpWs.readyState === WebSocket.OPEN) {
    lastCdpStatus = "connected";
    return {detail: lastCdpStatus, ok: true};
  }
  if (cdpConnectPromise !== undefined) {
    try {
      await cdpConnectPromise;
      return {detail: lastCdpStatus, ok: cdpWs?.readyState === WebSocket.OPEN};
    } catch (e) {
      return {detail: String(e), ok: false};
    }
  }

  cdpConnectPromise = (async () => {
    const base = resolveMetroHttpBase();
    const listUrl = `${base}/json/list`;
    let targets: Array<Record<string, unknown>>;
    try {
      const res = await fetch(listUrl, {signal: AbortSignal.timeout(4000)});
      if (!res.ok) {
        throw new Error(`GET /json/list -> ${res.status}`);
      }
      targets = (await res.json()) as Array<Record<string, unknown>>;
    } catch (e) {
      lastCdpStatus = `failed to reach Metro at ${base}: ${String(e)}`;
      throw e;
    }
    const target = pickDebugTarget(targets);
    const wsUrl = target?.webSocketDebuggerUrl;
    if (typeof wsUrl !== "string") {
      lastCdpStatus =
        "No debuggable Hermes/React Native target with webSocketDebuggerUrl (is the app running?)";
      throw new Error(lastCdpStatus);
    }

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      cdpWs = ws;
      ws.addEventListener("open", () => {
        resolve();
      });
      ws.addEventListener("error", (ev) => {
        if (cdpWs === ws) {
          cdpWs = undefined;
        }
        reject(new Error(`CDP websocket error: ${String((ev as ErrorEvent).message ?? ev)}`));
      });
      ws.addEventListener("message", (ev) => {
        if (typeof ev.data === "string") {
          handleCdpMessage(ev.data);
        }
      });
      ws.addEventListener("close", () => {
        if (cdpWs === ws) {
          cdpWs = undefined;
          lastCdpStatus = "CDP disconnected";
        }
      });
    });

    await sendCdp("Runtime.enable", {});
    lastCdpStatus = `connected to ${String(target?.title ?? "target")}`;
  })();

  try {
    await cdpConnectPromise;
    cdpConnectPromise = undefined;
    const ok = cdpWs?.readyState === WebSocket.OPEN;
    if (!ok) {
      lastCdpStatus = "CDP socket not open after connect";
    }
    return {detail: lastCdpStatus, ok};
  } catch (e) {
    cdpConnectPromise = undefined;
    if (cdpWs) {
      try {
        cdpWs.close();
      } catch {
        // ignore
      }
      cdpWs = undefined;
    }
    lastCdpStatus = String(e);
    return {detail: lastCdpStatus, ok: false};
  }
};

export const ensureMetroEventsConnected = async (): Promise<{ok: boolean; detail: string}> => {
  if (metroWs && metroWs.readyState === WebSocket.OPEN) {
    metroEventsStatus = "connected";
    return {detail: metroEventsStatus, ok: true};
  }

  const base = resolveMetroHttpBase();
  const wsBase = httpToWsBase(base);
  const url = `${wsBase}/events`;

  try {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      metroWs = ws;
      ws.addEventListener("open", () => {
        metroEventsStatus = `connected ${url}`;
        resolve();
      });
      ws.addEventListener("error", () => {
        reject(new Error(`Metro /events unreachable at ${url}`));
      });
      ws.addEventListener("message", (ev) => {
        const raw =
          typeof ev.data === "string" ? ev.data : JSON.stringify(ev.data, null, 0).slice(0, 4000);
        let level = "info";
        let message = raw.slice(0, 4000);
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const t = typeof parsed.type === "string" ? parsed.type : "";
          if (t.includes("error") || t.includes("failed")) {
            level = "error";
          }
          message = JSON.stringify(parsed).slice(0, 4000);
        } catch {
          // keep defaults
        }
        const line = JSON.stringify({
          level,
          message,
          source: "metro",
          timestamp: new Date().toISOString(),
        });
        pushRing(metroEventsRing, {
          level,
          raw: line,
          source: "metro",
          timestamp: new Date().toISOString(),
        });
      });
      ws.addEventListener("close", () => {
        if (metroWs === ws) {
          metroWs = undefined;
        }
      });
    });
    return {detail: metroEventsStatus, ok: true};
  } catch (e) {
    metroEventsStatus = String(e);
    return {detail: metroEventsStatus, ok: false};
  }
};

export const getCdpConnectionStatus = (): string => {
  return `CDP: ${lastCdpStatus}; Metro events: ${metroEventsStatus}`;
};

export const snapshotCdpConsoleRing = (): RingEntry[] => {
  return [...cdpConsoleRing];
};

export const snapshotMetroEventsRing = (): RingEntry[] => {
  return [...metroEventsRing];
};

export const cdpRuntimeEvaluate = async (
  expression: string,
  awaitPromise: boolean
): Promise<{error?: string; value?: unknown}> => {
  const conn = await ensureCdpConnected();
  if (!conn.ok) {
    return {error: conn.detail};
  }
  try {
    const reply = (await sendCdp("Runtime.evaluate", {
      awaitPromise,
      expression,
      returnByValue: true,
    })) as {
      result?: {exceptionDetails?: unknown; result?: Record<string, unknown>};
    };
    const evalPayload = reply.result;
    if (evalPayload?.exceptionDetails) {
      return {error: JSON.stringify(evalPayload.exceptionDetails)};
    }
    const remote = evalPayload?.result;
    if (remote?.subtype === "error" && remote.description) {
      return {error: String(remote.description)};
    }
    return {value: remote?.value};
  } catch (e) {
    return {error: String(e)};
  }
};
