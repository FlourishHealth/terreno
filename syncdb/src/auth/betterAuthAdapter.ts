import type {AuthProvider} from "../types";
import type {BetterAuthClientLike, BetterAuthSessionDataLike} from "./types";

/** Default polling cadence when the client exposes no session subscription. */
export const DEFAULT_AUTH_POLL_INTERVAL_MS = 5_000;

export interface BetterAuthAdapterOptions {
  /** Polling cadence for the fallback watcher (default {@link DEFAULT_AUTH_POLL_INTERVAL_MS}). */
  pollIntervalMs?: number;
  /** Interval scheduler, injectable for deterministic tests (default global setInterval). */
  setIntervalFn?: (handler: () => void, ms: number) => unknown;
  /** Interval canceller matching `setIntervalFn` (default global clearInterval). */
  clearIntervalFn?: (handle: unknown) => void;
}

/**
 * Unwrap `getSession()` results: Better Auth returns a `{data}` envelope, some
 * wrappers return the payload directly, and signed-out states are null-ish.
 */
const unwrapSession = (result: unknown): BetterAuthSessionDataLike | null => {
  if (!result || typeof result !== "object") {
    return null;
  }
  if ("data" in result) {
    const data = (result as {data?: BetterAuthSessionDataLike | null}).data;
    return data && typeof data === "object" ? data : null;
  }
  return result as BetterAuthSessionDataLike;
};

/**
 * Adapt a Better Auth client to syncdb's {@link AuthProvider} contract.
 * Tokens/user ids are read per call via `getSession()` (never cached, so
 * Better Auth session refresh is picked up transparently); auth changes are
 * delivered through the client's nanostore session atom when available, with
 * an injectable polling fallback otherwise. All read errors degrade to null —
 * a broken auth client behaves like "signed out", never a crash.
 */
export const betterAuthAdapter = (
  authClient: BetterAuthClientLike,
  options: BetterAuthAdapterOptions = {}
): AuthProvider => {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_AUTH_POLL_INTERVAL_MS;
  const setIntervalFn =
    options.setIntervalFn ??
    ((handler: () => void, ms: number): unknown => setInterval(handler, ms));
  const clearIntervalFn =
    options.clearIntervalFn ??
    ((handle: unknown): void => clearInterval(handle as ReturnType<typeof setInterval>));

  const readSession = async (): Promise<BetterAuthSessionDataLike | null> => {
    try {
      return unwrapSession(await authClient.getSession());
    } catch {
      return null;
    }
  };

  const getToken = async (): Promise<string | null> => {
    const session = await readSession();
    return session?.session?.token ?? null;
  };

  const getUserId = async (): Promise<string | null> => {
    const session = await readSession();
    return session?.user?.id ?? null;
  };

  /** Identity snapshot used by the polling fallback to detect auth changes. */
  const readAuthKey = async (): Promise<string> => {
    const session = await readSession();
    return `${session?.user?.id ?? ""}|${session?.session?.token ?? ""}`;
  };

  const onAuthChange = (callback: () => void): (() => void) => {
    const subscribe = authClient.useSession?.subscribe;
    if (typeof subscribe === "function") {
      const unsubscribe = subscribe(() => {
        callback();
      });
      return typeof unsubscribe === "function" ? unsubscribe : (): void => {};
    }

    // Polling fallback: sample the session identity and fire on change. The
    // first sample only establishes the baseline so subscribing never emits a
    // spurious change for the already-current session.
    let disposed = false;
    let lastKey: string | undefined;
    void readAuthKey().then((key) => {
      if (!disposed && lastKey === undefined) {
        lastKey = key;
      }
    });
    const handle = setIntervalFn(() => {
      void readAuthKey().then((key) => {
        if (disposed) {
          return;
        }
        if (lastKey === undefined) {
          lastKey = key;
          return;
        }
        if (key !== lastKey) {
          lastKey = key;
          callback();
        }
      });
    }, pollIntervalMs);
    return () => {
      disposed = true;
      clearIntervalFn(handle);
    };
  };

  return {getToken, getUserId, onAuthChange};
};
