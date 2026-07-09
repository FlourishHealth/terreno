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
    // total is a lifetime counter and survives clear.
    expect(log.getStats().total).toBe(1);
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
