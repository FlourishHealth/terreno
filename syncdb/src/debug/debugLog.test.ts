import {describe, expect, it} from "bun:test";

import {createSyncDebugLog, resolveDebugLog} from "./debugLog";

describe("createSyncDebugLog", () => {
  it("assigns monotonic ids and timestamps and preserves order", () => {
    let tick = 0;
    const log = createSyncDebugLog({clock: () => `2026-01-01T00:00:0${tick++}.000Z`});

    log.record({direction: "local", label: "one", type: "mutate"});
    log.record({direction: "inbound", label: "two", type: "delta"});

    const events = log.getEvents();
    expect(events.map((e) => e.id)).toEqual([1, 2]);
    expect(events.map((e) => e.label)).toEqual(["one", "two"]);
    expect(events[0].timestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(events[1].timestamp).toBe("2026-01-01T00:00:01.000Z");
  });

  it("evicts oldest events beyond capacity (circular buffer)", () => {
    const log = createSyncDebugLog({capacity: 3});
    for (let i = 1; i <= 5; i++) {
      log.record({direction: "local", label: `e${i}`, type: "mutate"});
    }

    const events = log.getEvents();
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.label)).toEqual(["e3", "e4", "e5"]);
    expect(events.map((e) => e.id)).toEqual([3, 4, 5]);

    const stats = log.getStats();
    expect(stats.total).toBe(5);
    expect(stats.retained).toBe(3);
    expect(stats.dropped).toBe(2);
    expect(stats.byType.mutate).toBe(5);
  });

  it("notifies subscribers with each new event and supports unsubscribe", () => {
    const log = createSyncDebugLog();
    const received: string[] = [];
    const unsubscribe = log.subscribe((event) => received.push(event.label));

    log.record({direction: "local", label: "a", type: "mutate"});
    unsubscribe();
    log.record({direction: "local", label: "b", type: "mutate"});

    expect(received).toEqual(["a"]);
  });

  it("bumps revision on record and clear", () => {
    const log = createSyncDebugLog();
    expect(log.getRevision()).toBe(0);
    log.record({direction: "local", label: "a", type: "mutate"});
    expect(log.getRevision()).toBe(1);
    log.clear();
    expect(log.getRevision()).toBe(2);
    expect(log.getEvents()).toHaveLength(0);
    // E6: clear() resets every derived stat coherently — total (and
    // everything else getStats() reports) describes only what happened
    // since the last clear, not a lifetime count that would otherwise be
    // inconsistent with retained: 0.
    expect(log.getStats().total).toBe(0);
  });

  it("clear() resets total/dropped/byType/firstEventAt/lastEventAt, not just retained (E6)", () => {
    const log = createSyncDebugLog({capacity: 2});
    log.record({direction: "local", label: "a", type: "mutate"});
    log.record({direction: "inbound", label: "b", type: "delta"});
    // Overflow past capacity to also populate `dropped`.
    log.record({direction: "inbound", label: "c", type: "ack"});

    const beforeClear = log.getStats();
    expect(beforeClear.total).toBe(3);
    expect(beforeClear.dropped).toBe(1);
    expect(beforeClear.byType.mutate).toBe(1);
    expect(beforeClear.firstEventAt).toBeDefined();
    expect(beforeClear.lastEventAt).toBeDefined();

    log.clear();
    const afterClear = log.getStats();
    expect(afterClear).toEqual({
      byType: {
        ack: 0,
        conflict: 0,
        connect: 0,
        delta: 0,
        disconnect: 0,
        failed: 0,
        mutate: 0,
        nack: 0,
        reconcile: 0,
        replay: 0,
        resolve: 0,
        retry: 0,
        send: 0,
      },
      dropped: 0,
      firstEventAt: undefined,
      lastEventAt: undefined,
      retained: 0,
      total: 0,
    });

    // A fresh record after clear reports as if the log were brand new, and
    // ids stay monotonic (not reset) across the clear.
    const next = log.record({direction: "local", label: "d", type: "mutate"});
    expect(next.id).toBe(4);
    expect(log.getStats()).toMatchObject({
      byType: {mutate: 1},
      dropped: 0,
      retained: 1,
      total: 1,
    });
  });

  it("snapshot returns a serializable events + stats view", () => {
    const log = createSyncDebugLog({capacity: 10});
    log.record({collection: "todos", direction: "local", label: "create", type: "mutate"});

    const snapshot = log.snapshot();
    expect(snapshot.capacity).toBe(10);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.stats.total).toBe(1);
    // Must round-trip through JSON unchanged (MCP-facing contract).
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("resolveDebugLog", () => {
  it("returns undefined when disabled", () => {
    expect(resolveDebugLog(undefined)).toBeUndefined();
    expect(resolveDebugLog(false)).toBeUndefined();
  });

  it("creates a log for true or options", () => {
    expect(resolveDebugLog(true)?.capacity).toBe(500);
    expect(resolveDebugLog({capacity: 25})?.capacity).toBe(25);
  });
});
