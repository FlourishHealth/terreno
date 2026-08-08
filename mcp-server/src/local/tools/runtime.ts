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

export interface GetRtkStateArgs {
  slice?: string;
}

export const getRtkState = (args: GetRtkStateArgs): string => {
  const store = getDevStore();
  if (!store) {
    return "Redux store not registered. In dev, call `registerTerrenoDevStore(store)` from your app after `configureStore`.";
  }
  const state = store.getState();
  const slice = args.slice?.trim();
  if (slice === "auth") {
    return JSON.stringify({auth: state.auth}, null, 2);
  }
  if (slice === "terreno-rtk" || slice === "rtk") {
    return JSON.stringify(summarizeRtkCache(state), null, 2);
  }
  if (slice) {
    return JSON.stringify({[slice]: state[slice]}, null, 2);
  }
  return JSON.stringify(
    {
      auth: state.auth,
      terrenoRtk: summarizeRtkCache(state),
    },
    null,
    2
  );
};

export interface EvaluateArgs {
  code: string;
}

export const evaluate = (_args: EvaluateArgs): string => {
  if (process.env.TERRENO_MCP_EVAL !== "1" && process.env.TERRENO_MCP_EVAL !== "true") {
    return "Refused: set `TERRENO_MCP_EVAL=1` to opt in to `Runtime.evaluate` (arbitrary JS in the app runtime).";
  }
  return "CDP evaluate is not connected in this build. Start Metro with debugging and use a future terreno-mcp-local release with Hermes CDP, or use Expo MCP tools.";
};

export interface NavigateArgs {
  path: string;
}

export const navigate = (_args: NavigateArgs): string => {
  return "Navigation via CDP is not connected in this build. Use Expo MCP automation tools with a running dev server, or call `router.push` from app code.";
};
