import {describe, expect, it} from "bun:test";

import {attachDebugChannel, type DebugBroadcastChannelLike} from "./debugChannel";
import {createSyncDebugLog} from "./debugLog";

/**
 * An in-memory BroadcastChannel hub so tests exercise the bridge without a real
 * DOM `BroadcastChannel`. Every channel created from the same hub delivers each
 * `postMessage` to all OTHER channels (never back to the sender), mirroring the
 * real cross-window semantics we depend on.
 */
const createChannelHub = (): {
  create: (name: string) => DebugBroadcastChannelLike;
} => {
  const channels = new Set<DebugBroadcastChannelLike>();
  return {
    create: (_name: string): DebugBroadcastChannelLike => {
      const channel: DebugBroadcastChannelLike = {
        close: () => {
          channels.delete(channel);
        },
        onmessage: null,
        postMessage: (message) => {
          for (const peer of channels) {
            if (peer !== channel) {
              peer.onmessage?.({data: message});
            }
          }
        },
      };
      channels.add(channel);
      return channel;
    },
  };
};

describe("attachDebugChannel", () => {
  it("returns undefined when no channel is available (native/SSR)", () => {
    const log = createSyncDebugLog();
    const bridge = attachDebugChannel({
      createChannel: () => undefined,
      log,
      name: "app",
    });
    expect(bridge).toBeUndefined();
  });

  it("mirrors a locally-recorded event into a peer window's log", () => {
    const hub = createChannelHub();
    const appLog = createSyncDebugLog();
    const debuggerLog = createSyncDebugLog();
    attachDebugChannel({createChannel: hub.create, log: appLog, name: "app"});
    attachDebugChannel({createChannel: hub.create, log: debuggerLog, name: "app"});

    appLog.record({
      collection: "todos",
      detail: {data: {title: "buy milk"}},
      direction: "local",
      entityId: "t1",
      label: "create todos/t1",
      operation: "create",
      type: "mutate",
    });

    const mirrored = debuggerLog.getEvents();
    expect(mirrored).toHaveLength(1);
    expect(mirrored[0].type).toBe("mutate");
    expect(mirrored[0].label).toBe("create todos/t1");
    // The create/update body survives the hop so the debugger can show it.
    expect(mirrored[0].detail?.data).toEqual({title: "buy milk"});
  });

  it("preserves the original timestamp but assigns a fresh local id on the peer", () => {
    const hub = createChannelHub();
    const appLog = createSyncDebugLog();
    const debuggerLog = createSyncDebugLog();
    // Pre-seed the peer so its next id differs from the source event's id.
    debuggerLog.record({direction: "system", label: "seed", type: "connect"});
    attachDebugChannel({createChannel: hub.create, log: appLog, name: "app"});
    attachDebugChannel({createChannel: hub.create, log: debuggerLog, name: "app"});

    const source = appLog.record({
      direction: "local",
      label: "create todos/t1",
      timestamp: "2026-07-16T16:01:45.011-07:00",
      type: "mutate",
    });

    const mirrored = debuggerLog.getEvents().find((event) => event.label === "create todos/t1");
    expect(mirrored?.timestamp).toBe("2026-07-16T16:01:45.011-07:00");
    expect(mirrored?.id).not.toBe(source.id);
  });

  it("does not echo a mirrored event back to the origin (no infinite loop)", () => {
    const hub = createChannelHub();
    const appLog = createSyncDebugLog();
    const debuggerLog = createSyncDebugLog();
    attachDebugChannel({createChannel: hub.create, log: appLog, name: "app"});
    attachDebugChannel({createChannel: hub.create, log: debuggerLog, name: "app"});

    appLog.record({direction: "local", label: "one", type: "mutate"});

    // The source window keeps exactly one event; the peer's re-record must not
    // bounce back and inflate the source log.
    expect(appLog.getEvents()).toHaveLength(1);
    expect(debuggerLog.getEvents()).toHaveLength(1);
  });

  it("stops mirroring after close()", () => {
    const hub = createChannelHub();
    const appLog = createSyncDebugLog();
    const debuggerLog = createSyncDebugLog();
    const appBridge = attachDebugChannel({createChannel: hub.create, log: appLog, name: "app"});
    attachDebugChannel({createChannel: hub.create, log: debuggerLog, name: "app"});

    appBridge?.close();
    appLog.record({direction: "local", label: "after close", type: "mutate"});

    expect(debuggerLog.getEvents()).toHaveLength(0);
  });
});
