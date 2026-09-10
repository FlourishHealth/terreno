import {afterEach, describe, it} from "bun:test";
import {act} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import {AdminProvider} from "./AdminProvider";
import type {AdminApi} from "./types";
import {useAdminRpc, useAdminRpcMutation, useAdminRpcQuery} from "./useAdminRpc";

const api = {} as unknown as AdminApi;

const Probe: React.FC<{onValue: (value: unknown) => void; renderValue: () => unknown}> = ({
  onValue,
  renderValue,
}) => {
  onValue(renderValue());
  return null;
};

describe("useAdminRpc", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns undefined rpc outside a fetch-capable provider", () => {
    let rpc: unknown;
    renderWithTheme(
      <AdminProvider api={api} apiBase="/admin" routeBase="/admin">
        <Probe
          onValue={(value) => {
            rpc = value;
          }}
          renderValue={useAdminRpc}
        />
      </AdminProvider>
    );
    assert.isUndefined(rpc);
  });

  it("skips queries when rpc is missing or skip is true", () => {
    let state: {isLoading?: boolean; data?: unknown} | undefined;
    renderWithTheme(
      <AdminProvider api={api} apiBase="/admin" routeBase="/admin">
        <Probe
          onValue={(value) => {
            state = value as {isLoading?: boolean; data?: unknown};
          }}
          renderValue={() => useAdminRpcQuery({rpc: undefined, skip: true, url: "/x"})}
        />
      </AdminProvider>
    );
    assert.isFalse(state?.isLoading);
    assert.isUndefined(state?.data);
  });

  it("loads GET data, surfaces errors, and refetches", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ok: true}), {
          headers: {"Content-Type": "application/json"},
          status: 200,
        });
      }
      return new Response("nope", {status: 500});
    }) as typeof fetch;

    let latest: {
      data?: {ok: boolean};
      error?: unknown;
      refetch: () => void;
    } = {refetch: () => undefined};

    const Harness: React.FC = () => {
      const rpc = useAdminRpc();
      latest = useAdminRpcQuery<{ok: boolean}>({rpc, url: "/ping"});
      return null;
    };

    renderWithTheme(
      <AdminProvider
        api={api}
        apiBase="/admin"
        credentials="same-origin"
        getAuthHeaders={() => ({})}
        routeBase="/admin"
      >
        <Harness />
      </AdminProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });
    assert.deepEqual(latest.data, {ok: true});

    await act(async () => {
      latest.refetch();
      await Promise.resolve();
    });
    assert.isOk(latest.error);
  });

  it("polls on an interval and mutations unwrap or throw", async () => {
    let gets = 0;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return new Response(JSON.stringify({saved: true}), {
          headers: {"Content-Type": "application/json"},
          status: 200,
        });
      }
      gets += 1;
      return new Response(JSON.stringify({n: gets}), {
        headers: {"Content-Type": "application/json"},
        status: 200,
      });
    }) as typeof fetch;

    let trigger:
      | ((args: {method: "POST"; url: string}) => {unwrap: () => Promise<unknown>})
      | undefined;
    let missingRpcTrigger:
      | ((args: {method: "POST"; url: string}) => {unwrap: () => Promise<unknown>})
      | undefined;

    const Harness: React.FC = () => {
      const rpc = useAdminRpc();
      useAdminRpcQuery({pollingInterval: 20, rpc, url: "/poll"});
      const [mutate] = useAdminRpcMutation(rpc);
      const [mutateMissing] = useAdminRpcMutation(undefined);
      trigger = mutate;
      missingRpcTrigger = mutateMissing;
      return null;
    };

    renderWithTheme(
      <AdminProvider
        api={api}
        apiBase="/admin"
        credentials="same-origin"
        getAuthHeaders={() => ({})}
        routeBase="/admin"
      >
        <Harness />
      </AdminProvider>
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    assert.isAtLeast(gets, 2);

    const saved = await trigger?.({method: "POST", url: "/save"}).unwrap();
    assert.deepEqual(saved, {saved: true});

    let threw = false;
    try {
      await missingRpcTrigger?.({method: "POST", url: "/save"}).unwrap();
    } catch (err) {
      threw = true;
      assert.include(String(err), "unavailable");
    }
    assert.isTrue(threw);
  });
});
