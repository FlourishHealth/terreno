import {afterEach, beforeEach, describe, it, mock} from "bun:test";
import {assert} from "chai";

const cdpState: {reply: {error?: string; value?: unknown}} = {
  reply: {error: "cdp down"},
};

mock.module("../metro/metroDevSession.js", () => ({
  cdpRuntimeEvaluate: async (): Promise<{error?: string; value?: unknown}> => cdpState.reply,
  getCdpConnectionStatus: (): string => "CDP: mocked",
}));

const {getSyncDbState, syncDbAction} = await import("./syncDb");

describe("SyncDB local MCP CDP fallback", () => {
  let previousEval: string | undefined;

  beforeEach((): void => {
    previousEval = process.env.TERRENO_MCP_EVAL;
    process.env.TERRENO_MCP_EVAL = "1";
    Reflect.deleteProperty(globalThis, "__TERRENO_SYNCDB__");
    cdpState.reply = {error: "cdp down"};
  });

  afterEach((): void => {
    Reflect.deleteProperty(globalThis, "__TERRENO_SYNCDB__");
    if (previousEval === undefined) {
      Reflect.deleteProperty(process.env, "TERRENO_MCP_EVAL");
    } else {
      process.env.TERRENO_MCP_EVAL = previousEval;
    }
  });

  it("surfaces CDP evaluation errors", async (): Promise<void> => {
    assert.include(await getSyncDbState({}), "cdp down");
    assert.include(await getSyncDbState({}), "CDP: mocked");
  });

  it("returns CDP payload errors and successful inspect results", async (): Promise<void> => {
    cdpState.reply = {value: {available: [], error: "unknown SyncDB client", ok: false}};
    assert.include(await getSyncDbState({name: "missing"}), "unknown SyncDB client");

    cdpState.reply = {
      value: {
        name: "app",
        ok: true,
        result: {status: {queuedCount: 2}},
      },
    };
    const state = JSON.parse(await getSyncDbState({})) as {status: {queuedCount: number}};
    assert.equal(state.status.queuedCount, 2);

    const action = JSON.parse(await syncDbAction({action: "flush"})) as {
      client: string;
      result: unknown;
    };
    assert.equal(action.client, "app");
  });
});
