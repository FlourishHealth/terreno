import {
  cdpRuntimeEvaluate,
  ensureCdpConnected,
  getCdpConnectionStatus,
} from "../metro/metroDevSession.js";

interface TerrenoDevStore {
  getState: () => Record<string, unknown>;
}

const getDevStore = (): TerrenoDevStore | undefined => {
  return (globalThis as typeof globalThis & {__TERRENO_STORE__?: TerrenoDevStore})
    .__TERRENO_STORE__;
};

const summarizeRtkCache = (state: Record<string, unknown>): unknown => {
  const apiState = state["terreno-rtk"] as
    | {
        queries?: Record<string, {status?: string; endpointName?: string; originalArgs?: unknown}>;
        mutations?: Record<
          string,
          {status?: string; endpointName?: string; originalArgs?: unknown}
        >;
      }
    | undefined;
  if (!apiState) {
    return {note: "No terreno-rtk slice found on store."};
  }
  const queries = apiState.queries ?? {};
  const mutations = apiState.mutations ?? {};
  const qList = Object.values(queries).map((q) => ({
    args: q.originalArgs,
    endpoint: q.endpointName,
    status: q.status,
  }));
  const mList = Object.values(mutations).map((m) => ({
    args: m.originalArgs,
    endpoint: m.endpointName,
    status: m.status,
  }));
  return {mutations: mList, queries: qList};
};

const filterByQuery = (data: unknown, query: string | undefined): unknown => {
  if (!query?.trim()) {
    return data;
  }
  const q = query.trim().toLowerCase();
  if (typeof data !== "object" || data === null) {
    return data;
  }
  const tr = data as {queries?: unknown[]; mutations?: unknown[]};
  if (!Array.isArray(tr.queries) && !Array.isArray(tr.mutations)) {
    return data;
  }
  const matchEndpoint = (row: unknown): boolean => {
    if (typeof row !== "object" || row === null) {
      return false;
    }
    const r = row as {endpoint?: string; args?: unknown};
    const ep = (r.endpoint ?? "").toString().toLowerCase();
    const args = JSON.stringify(r.args ?? {}).toLowerCase();
    return ep.includes(q) || args.includes(q);
  };
  return {
    ...tr,
    mutations: Array.isArray(tr.mutations) ? tr.mutations.filter(matchEndpoint) : tr.mutations,
    queries: Array.isArray(tr.queries) ? tr.queries.filter(matchEndpoint) : tr.queries,
  };
};

export interface GetRtkStateArgs {
  slice?: string;
  query?: string;
}

const STORE_READ_EXPR = `(() => {
  const s = globalThis.__TERRENO_STORE__;
  if (!s || typeof s.getState !== "function") {
    return { ok: false, error: "no __TERRENO_STORE__" };
  }
  try {
    return { ok: true, state: s.getState() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
})()`;

export const getRtkState = (args: GetRtkStateArgs): Promise<string> => {
  return (async (): Promise<string> => {
    const slice = args.slice?.trim();
    const query = args.query?.trim();

    const local = getDevStore();
    if (local) {
      const state = local.getState();
      if (slice === "auth") {
        return JSON.stringify({auth: state.auth}, null, 2);
      }
      if (slice === "terreno-rtk" || slice === "rtk") {
        const summarized = summarizeRtkCache(state);
        return JSON.stringify(filterByQuery(summarized, query), null, 2);
      }
      if (slice) {
        return JSON.stringify({[slice]: state[slice]}, null, 2);
      }
      return JSON.stringify(
        {
          auth: state.auth,
          terrenoRtk: filterByQuery(summarizeRtkCache(state), query),
        },
        null,
        2
      );
    }

    const ev = await cdpRuntimeEvaluate(STORE_READ_EXPR, true);
    if (ev.error) {
      return `${ev.error}\n${getCdpConnectionStatus()}`;
    }
    const payload = ev.value as
      | {error?: string; ok?: boolean; state?: Record<string, unknown>}
      | undefined;
    if (!payload?.ok || !payload.state) {
      return `Could not read store from app: ${JSON.stringify(payload ?? ev.value)}\n${getCdpConnectionStatus()}`;
    }
    const state = payload.state;
    if (slice === "auth") {
      return JSON.stringify({auth: state.auth}, null, 2);
    }
    if (slice === "terreno-rtk" || slice === "rtk") {
      const summarized = summarizeRtkCache(state);
      return JSON.stringify(filterByQuery(summarized, query), null, 2);
    }
    if (slice) {
      return JSON.stringify({[slice]: state[slice]}, null, 2);
    }
    return JSON.stringify(
      {
        auth: state.auth,
        terrenoRtk: filterByQuery(summarizeRtkCache(state), query),
      },
      null,
      2
    );
  })();
};

export interface EvaluateArgs {
  code: string;
}

export const evaluate = (args: EvaluateArgs): Promise<string> => {
  return (async (): Promise<string> => {
    if (process.env.TERRENO_MCP_EVAL !== "1" && process.env.TERRENO_MCP_EVAL !== "true") {
      return "Refused: set `TERRENO_MCP_EVAL=1` to opt in to `Runtime.evaluate` (arbitrary JS in the app runtime).";
    }
    const trimmed = args.code.trim();
    if (!trimmed) {
      return "No code provided.";
    }
    const ev = await cdpRuntimeEvaluate(trimmed, true);
    if (ev.error) {
      return JSON.stringify({error: ev.error, status: getCdpConnectionStatus()}, null, 2);
    }
    return JSON.stringify({result: ev.value, status: getCdpConnectionStatus()}, null, 2);
  })();
};

export interface NavigateArgs {
  path: string;
}

const buildNavigateExpr = (path: string): string => {
  const enc = JSON.stringify(path);
  return `(() => {
  try {
    const expoRouter = require("expo-router");
    const r = expoRouter.router;
    if (r && typeof r.navigate === "function") {
      r.navigate(${enc});
      return { ok: true, method: "navigate" };
    }
    if (r && typeof r.push === "function") {
      r.push(${enc});
      return { ok: true, method: "push" };
    }
    return { ok: false, error: "expo-router router has no navigate/push" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
})()`;
};

export const navigate = (args: NavigateArgs): Promise<string> => {
  return (async (): Promise<string> => {
    if (process.env.TERRENO_MCP_EVAL !== "1" && process.env.TERRENO_MCP_EVAL !== "true") {
      return "Refused: set `TERRENO_MCP_EVAL=1` to opt in to CDP-driven navigation (runs a fixed expo-router snippet in the app).";
    }
    const path = args.path.trim();
    if (!path) {
      return "No path provided.";
    }
    await ensureCdpConnected();
    const ev = await cdpRuntimeEvaluate(buildNavigateExpr(path), true);
    if (ev.error) {
      return JSON.stringify({error: ev.error, status: getCdpConnectionStatus()}, null, 2);
    }
    return JSON.stringify({result: ev.value, status: getCdpConnectionStatus()}, null, 2);
  })();
};
