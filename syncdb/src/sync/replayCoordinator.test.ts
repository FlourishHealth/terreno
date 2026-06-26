import {beforeEach, describe, expect, it} from "bun:test";

import {createConflictStore} from "../mutations/conflicts";
import {createOutbox} from "../mutations/outbox";
import {createSyncStore, type SyncStore} from "../storage/store";
import {createFakeTransport, type FakeTransport} from "./fakeTransport";
import {createReplayCoordinator} from "./replayCoordinator";

describe("createReplayCoordinator", () => {
  let store: SyncStore;
  let outbox: ReturnType<typeof createOutbox>;
  let conflicts: ReturnType<typeof createConflictStore>;
  let transport: FakeTransport;
  let authBlocked: boolean[];
  let stop: () => void;

  beforeEach(() => {
    store = createSyncStore();
    outbox = createOutbox({store: store.raw});
    conflicts = createConflictStore({store: store.raw});
    transport = createFakeTransport();
    authBlocked = [];
    const coordinator = createReplayCoordinator({
      conflicts,
      onAuthBlocked: (blocked) => authBlocked.push(blocked),
      outbox,
      store,
      transport,
    });
    stop = coordinator.start();

    store.upsertEntity({collection: "todos", data: {title: "Mine"}, id: "t1"});
    outbox.enqueue({
      args: {title: "Mine"},
      collection: "todos",
      entityId: "t1",
      mutationId: "m1",
      operation: "update",
    });
    coordinator.replay();
  });

  it("sends queued mutations and marks them in flight", () => {
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({mutationId: "m1", type: "mutation"});
    expect(outbox.get({mutationId: "m1"})?.status).toBe("inFlight");
    stop();
  });

  it("acks remove the mutation from the outbox", () => {
    transport.emit({mutationId: "m1", type: "sync:ack", version: "v2"});
    expect(outbox.get({mutationId: "m1"})).toBeUndefined();
    stop();
  });

  it("conflict nacks capture a conflict and mark the mutation conflicted", () => {
    transport.emit({
      mutationId: "m1",
      reason: "conflict",
      serverData: {title: "Server"},
      type: "sync:nack",
    });

    expect(outbox.get({mutationId: "m1"})?.status).toBe("conflicted");
    const captured = conflicts.list<{title: string}>();
    expect(captured).toHaveLength(1);
    expect(captured[0].serverData).toEqual({title: "Server"});
    expect(captured[0].localData).toEqual({title: "Mine"});
    stop();
  });

  it("auth nacks requeue the mutation and report auth-blocked", () => {
    transport.emit({mutationId: "m1", reason: "auth", type: "sync:nack"});
    expect(outbox.get({mutationId: "m1"})?.status).toBe("queued");
    expect(authBlocked).toContain(true);
    stop();
  });

  it("validation nacks mark the mutation failed", () => {
    transport.emit({mutationId: "m1", reason: "validation", type: "sync:nack"});
    expect(outbox.get({mutationId: "m1"})?.status).toBe("failed");
    stop();
  });

  it("ignores events for unknown mutations", () => {
    expect(() => transport.emit({mutationId: "unknown", type: "sync:ack"})).not.toThrow();
    stop();
  });
});
