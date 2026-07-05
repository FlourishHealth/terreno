import {describe, expect, it} from "bun:test";

import type {AuthProvider} from "../types";
import {AuthRequiredError, createHttpChannel, type FetchLike} from "./httpChannel";

const authProvider: Pick<AuthProvider, "getToken"> = {
  getToken: async () => "token-123",
};

interface RecordedRequest {
  input: string;
  init?: RequestInit;
}

const makeFetch = (
  responder: (input: string, init?: RequestInit) => Response | Promise<Response>
): {fetchImpl: FetchLike; requests: RecordedRequest[]} => {
  const requests: RecordedRequest[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    requests.push({init, input});
    return responder(input, init);
  };
  return {fetchImpl, requests};
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: {"Content-Type": "application/json"},
    status,
  });

describe("createHttpChannel", () => {
  describe("fetchSnapshotPage", () => {
    it("requests the snapshot with bearer token, collection, cursor, and limit", async () => {
      const page = {cursor: 5, entities: [], hasMore: false};
      const {fetchImpl, requests} = makeFetch(() => json(page));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      const result = await channel.fetchSnapshotPage({collection: "todos", cursor: 3, limit: 10});
      expect(result).toEqual(page);
      expect(requests[0]?.input).toBe(
        "http://api/sync/snapshot?collection=todos&cursor=3&limit=10"
      );
      expect((requests[0]?.init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer token-123"
      );
    });

    it("omits the limit parameter and the auth header when absent", async () => {
      const {fetchImpl, requests} = makeFetch(() =>
        json({cursor: 0, entities: [], hasMore: false})
      );
      const channel = createHttpChannel({
        authProvider: {getToken: async () => null},
        baseUrl: "http://api",
        fetchImpl,
      });
      await channel.fetchSnapshotPage({collection: "todos", cursor: 0});
      expect(requests[0]?.input).toBe("http://api/sync/snapshot?collection=todos&cursor=0");
      expect((requests[0]?.init?.headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it("rejects with AuthRequiredError on 401", async () => {
      const {fetchImpl} = makeFetch(() => json({}, 401));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.fetchSnapshotPage({collection: "todos", cursor: 0})).rejects.toThrow(
        AuthRequiredError
      );
    });

    it("rejects on non-ok statuses", async () => {
      const {fetchImpl} = makeFetch(() => json({}, 404));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.fetchSnapshotPage({collection: "todos", cursor: 0})).rejects.toThrow(
        "status 404"
      );
    });

    it("propagates network errors", async () => {
      const {fetchImpl} = makeFetch(() => {
        throw new Error("offline");
      });
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.fetchSnapshotPage({collection: "todos", cursor: 0})).rejects.toThrow(
        "offline"
      );
    });
  });

  describe("sendMutation", () => {
    const mutation = {
      collection: "todos",
      data: {title: "hi"},
      id: "t1",
      mutationId: "m1",
      operation: "create" as const,
    };

    it("POSTs the mutation and maps 200 {ack} to an ack result", async () => {
      const ack = {id: "t1", mutationId: "m1", seq: 7};
      const {fetchImpl, requests} = makeFetch(() => json({ack}));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      const result = await channel.sendMutation(mutation);
      expect(result).toEqual({ack, type: "ack"});
      expect(requests[0]?.input).toBe("http://api/sync/mutate");
      expect(requests[0]?.init?.method).toBe("POST");
      expect(JSON.parse(String(requests[0]?.init?.body))).toEqual(mutation);
      const headers = requests[0]?.init?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it.each([
      [409, "conflict"],
      [403, "unauthorized"],
      [422, "validation"],
      [500, "error"],
    ] as const)("maps %i {nack} bodies to nack results", async (status, code) => {
      const nack = {code, mutationId: "m1", serverSeq: 3};
      const {fetchImpl} = makeFetch(() => json({nack}, status));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      const result = await channel.sendMutation(mutation);
      expect(result).toEqual({nack, type: "nack"});
    });

    it("rejects with AuthRequiredError on 401", async () => {
      const {fetchImpl} = makeFetch(() => json({}, 401));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.sendMutation(mutation)).rejects.toThrow(AuthRequiredError);
    });

    it("rejects when an error status has no nack body", async () => {
      const {fetchImpl} = makeFetch(() => json({}, 500));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.sendMutation(mutation)).rejects.toThrow("status 500");
    });

    it("rejects on non-JSON responses", async () => {
      const {fetchImpl} = makeFetch(() => new Response("<html>bad gateway</html>", {status: 502}));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.sendMutation(mutation)).rejects.toThrow("non-JSON");
    });

    it("rejects when a 200 body carries neither ack nor nack", async () => {
      const {fetchImpl} = makeFetch(() => json({}));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.sendMutation(mutation)).rejects.toThrow("status 200");
    });
  });

  it("uses global fetch when no fetchImpl is provided (network error path)", async () => {
    const channel = createHttpChannel({
      authProvider,
      // Port 9 (discard) is never listening locally; fetch fails fast.
      baseUrl: "http://127.0.0.1:9",
    });
    await expect(channel.fetchSnapshotPage({collection: "todos", cursor: 0})).rejects.toThrow();
  });

  describe("fetchKeyMaterial", () => {
    it("fetches GET /sync/key with the bearer token and returns the material", async () => {
      const {fetchImpl, requests} = makeFetch(() => json({keyMaterial: "material-abc"}));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.fetchKeyMaterial()).resolves.toBe("material-abc");
      expect(requests[0].input).toBe("http://api/sync/key");
      expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer token-123"
      );
    });

    it("rejects with AuthRequiredError on 401", async () => {
      const {fetchImpl} = makeFetch(() => json({}, 401));
      const channel = createHttpChannel({authProvider, baseUrl: "http://api", fetchImpl});
      await expect(channel.fetchKeyMaterial()).rejects.toBeInstanceOf(AuthRequiredError);
    });

    it("rejects on non-ok statuses and missing keyMaterial", async () => {
      const bad = createHttpChannel({
        authProvider,
        baseUrl: "http://api",
        fetchImpl: makeFetch(() => json({}, 500)).fetchImpl,
      });
      await expect(bad.fetchKeyMaterial()).rejects.toThrow(/status 500/);

      const empty = createHttpChannel({
        authProvider,
        baseUrl: "http://api",
        fetchImpl: makeFetch(() => json({})).fetchImpl,
      });
      await expect(empty.fetchKeyMaterial()).rejects.toThrow(/missing keyMaterial/);
    });
  });
});
