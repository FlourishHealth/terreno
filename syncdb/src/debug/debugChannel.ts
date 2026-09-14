/**
 * Cross-window bridge for the SyncDB debug log.
 *
 * The debug log (see `debugLog.ts`) is an in-memory, per-client recorder. Each
 * browser window loads the app bundle fresh, so it builds its own `SyncDb`
 * singleton with its own log. That means the debugger — which is designed to run
 * side-by-side in a SECOND browser window — never sees local mutations recorded
 * by the primary app window: they live only in the app window's heap.
 *
 * This bridge mirrors locally-recorded events onto a `BroadcastChannel` and
 * re-records events received from peer windows into the local log, so a debugger
 * open in any window shows the full picture (local mutations included), live.
 *
 * It is web-only: on native / SSR / older runtimes without `BroadcastChannel`
 * the default factory returns nothing and `attachDebugChannel` no-ops. The
 * channel is only ever created when a debug log exists (dev builds by default),
 * so there is zero overhead in production where debug is off.
 */

import type {SyncDebugEvent, SyncDebugLog} from "./debugLog";

/** Channel name prefix; scoped per db `name` so unrelated apps never cross-talk. */
const CHANNEL_PREFIX = "terreno-syncdb-debug";

/** Message shape sent between windows. `origin` lets a sender ignore echoes. */
interface DebugChannelMessage {
  origin: string;
  event: SyncDebugEvent;
}

/**
 * Minimal structural subset of the DOM `BroadcastChannel` we rely on. Declared
 * locally (rather than depending on DOM lib types) so the package compiles under
 * a non-DOM `lib` and so tests can inject an in-memory fake.
 */
export interface DebugBroadcastChannelLike {
  postMessage: (message: DebugChannelMessage) => void;
  close: () => void;
  onmessage: ((event: {data: DebugChannelMessage}) => void) | null;
}

export interface DebugChannelBridge {
  /** Tear down: stop mirroring and close the underlying channel. */
  close: () => void;
}

const defaultChannelFactory = (channelName: string): DebugBroadcastChannelLike | undefined => {
  if (typeof BroadcastChannel === "undefined") {
    return undefined;
  }
  return new BroadcastChannel(channelName) as unknown as DebugBroadcastChannelLike;
};

/**
 * Wire a debug log to peer windows. Returns `undefined` when no channel is
 * available (native / SSR), in which case the log stays purely local.
 */
export const attachDebugChannel = ({
  log,
  name,
  createChannel = defaultChannelFactory,
}: {
  log: SyncDebugLog;
  name: string;
  /** Channel factory; injectable for tests. Defaults to a real BroadcastChannel. */
  createChannel?: (channelName: string) => DebugBroadcastChannelLike | undefined;
}): DebugChannelBridge | undefined => {
  const channel = createChannel(`${CHANNEL_PREFIX}:${name}`);
  if (!channel) {
    return undefined;
  }

  // Unique per bridge instance (i.e. per window). Used to drop echoes and to
  // keep a peer's re-recorded event from bouncing back and forth forever.
  const origin = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  // True only while we are re-recording a peer's event into the local log, so
  // the subscribe callback below skips broadcasting it back out (no echo loop).
  let ingestingRemote = false;

  const unsubscribe = log.subscribe((event) => {
    if (ingestingRemote) {
      return;
    }
    channel.postMessage({event, origin});
  });

  channel.onmessage = (messageEvent): void => {
    const data = messageEvent.data;
    if (!data || data.origin === origin) {
      return;
    }
    // Re-record the peer's event locally: it gets a fresh local id (ids only need
    // to be monotonic within a window) but keeps its original timestamp, type, and
    // detail so the debugger renders it inline with local events.
    const {id: _id, ...input} = data.event;
    ingestingRemote = true;
    try {
      log.record(input);
    } finally {
      ingestingRemote = false;
    }
  };

  return {
    close: (): void => {
      unsubscribe();
      channel.onmessage = null;
      channel.close();
    },
  };
};
