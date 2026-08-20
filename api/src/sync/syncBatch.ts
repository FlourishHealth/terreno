import type express from "express";
import type {User} from "../auth";
import {logger} from "../logger";
import {
  applySyncMutation,
  applySyncMutationBatch,
  type SyncMutationOutcome,
  type SyncMutationScopeResolver,
  validateSyncMutationBatch,
} from "./mutationHandler";
import type {SyncMutateBatchResponse, SyncMutateRequest, SyncNack} from "./types";

/**
 * Task 9.20: the single orchestration both mutation transports run.
 *
 * `POST /sync/mutate{,/batch}` and `sync:mutate{,Batch}` used to each carry their own copy
 * of the size-cap -> rate-limit -> validate -> apply sequence, and the socket budget lived
 * in a per-connection closure — so one user on N sockets got N times the budget, while the
 * HTTP window map was per-user but never evicted. Everything now funnels through
 * {@link runSyncMutation} / {@link runSyncBatch} against ONE per-user window map, so a
 * user's budget is theirs no matter how many sockets or HTTP requests they spread it over.
 *
 * Multi-instance semantics: the window map is per PROCESS, so a deployment running N API
 * instances behind a load balancer grants up to N times this budget per user in the worst
 * case. That is intentional — this limiter exists to stop a runaway client from saturating
 * one process, not to meter fair use across a cluster. A cluster-wide limit needs shared
 * state (Redis) and belongs in front of the app, not here.
 */
export const MAX_SYNC_MUTATIONS_PER_SECOND = 100;

/** Width of the rolling per-user mutation budget window. */
const RATE_LIMIT_WINDOW_MS = 1000;

/**
 * How often expired windows are swept out of the map. Windows are only 1s wide, so an
 * unswept map would otherwise retain one entry per user seen since process start.
 */
const WINDOW_EVICTION_INTERVAL_MS = 60_000;

interface MutationWindow {
  /** Epoch ms the current window opened. */
  windowStart: number;
  /** Mutations charged to the current window. */
  count: number;
}

/** userId -> rolling one-second mutation window, shared by every transport. */
const mutationWindows = new Map<string, MutationWindow>();

let lastEvictionAt = 0;

/**
 * Drop windows that have expired, so the map does not grow with every user ever seen.
 * Runs automatically (throttled to {@link WINDOW_EVICTION_INTERVAL_MS}) whenever budget is
 * charged; `now` is injectable so the sweep can be exercised without waiting a minute.
 * Returns the number of windows still retained.
 */
export const evictExpiredSyncMutationWindows = ({
  now = Date.now(),
}: {
  now?: number;
} = {}): number => {
  lastEvictionAt = now;
  for (const [userId, window] of mutationWindows) {
    if (now - window.windowStart >= RATE_LIMIT_WINDOW_MS) {
      mutationWindows.delete(userId);
    }
  }
  return mutationWindows.size;
};

/** Sweep expired windows at most once per {@link WINDOW_EVICTION_INTERVAL_MS}. */
const maybeEvictExpiredWindows = (now: number): void => {
  if (now - lastEvictionAt < WINDOW_EVICTION_INTERVAL_MS) {
    return;
  }
  evictExpiredSyncMutationWindows({now});
};

/**
 * Charge `weight` mutations to `userId`'s rolling window. Returns `undefined` when the
 * budget allowed it (and the weight was consumed), or the ms remaining in the window when
 * it did not — the caller nacks `rate_limited` with that as `retryAfterMs` rather than
 * burning any retry budget (rate limiting must never look like a durable-data error).
 *
 * A rejected request consumes nothing: a client held over budget would otherwise keep its
 * own window pinned full and never recover within the second.
 */
const consumeMutationBudget = ({
  userId,
  weight,
}: {
  userId: string;
  weight: number;
}): number | undefined => {
  const now = Date.now();
  maybeEvictExpiredWindows(now);
  const existing = mutationWindows.get(userId);
  const window =
    !existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS
      ? {count: 0, windowStart: now}
      : existing;
  if (window.count + weight > MAX_SYNC_MUTATIONS_PER_SECOND) {
    // Keep the window as-is (a fresh one is not stored) so the caller's retryAfterMs
    // reflects the window that is actually full.
    return Math.max(0, RATE_LIMIT_WINDOW_MS - (now - window.windowStart));
  }
  window.count += weight;
  mutationWindows.set(userId, window);
  return undefined;
};

/** Clear every per-user window. Test-only: windows are module state shared across suites. */
export const resetSyncMutationRateLimits = (): void => {
  mutationWindows.clear();
  lastEvictionAt = 0;
};

/** Number of retained per-user windows — lets tests assert eviction actually happens. */
export const syncMutationRateLimitWindowCount = (): number => mutationWindows.size;

/** The `rate_limited` nack both transports return, minus the mutationId the caller knows. */
const rateLimitNack = (retryAfterMs: number): Omit<SyncNack, "mutationId"> => ({
  code: "rate_limited",
  message: `Rate limit of ${MAX_SYNC_MUTATIONS_PER_SECOND} mutations per second exceeded`,
  retryAfterMs,
});

/**
 * Which stage produced the result. The HTTP routes map this to a status code
 * (`rate_limited` -> 429, `validation` -> 422, `applied` -> 200); the socket handlers
 * ignore it and just return the payload.
 */
export type SyncRunStage = "applied" | "rate_limited" | "validation";

export interface SyncMutationRunResult {
  stage: Exclude<SyncRunStage, "validation">;
  outcome: SyncMutationOutcome;
}

export interface SyncBatchRunResult {
  stage: SyncRunStage;
  response: SyncMutateBatchResponse;
}

/** Shared orchestration for a SINGLE mutation: rate limit, then apply. */
export const runSyncMutation = async ({
  mutation,
  req,
  scopeResolver,
  user,
}: {
  mutation: SyncMutateRequest;
  /** The real Express request when called over HTTP; hooks receive a `{user}` stub otherwise. */
  req?: express.Request;
  scopeResolver?: SyncMutationScopeResolver;
  user: User;
}): Promise<SyncMutationRunResult> => {
  const userId = String(user.id);
  const mutationId = typeof mutation?.mutationId === "string" ? mutation.mutationId : "";
  const retryAfterMs = consumeMutationBudget({userId, weight: 1});
  if (retryAfterMs !== undefined) {
    logger.info("[sync] User hit the sync mutation rate limit", {mutationId, userId});
    return {
      outcome: {nack: {mutationId, ...rateLimitNack(retryAfterMs)}, type: "nack"},
      stage: "rate_limited",
    };
  }
  return {
    outcome: await applySyncMutation({mutation, req, scopeResolver, user}),
    stage: "applied",
  };
};

/**
 * Shared orchestration for a BATCH: validate (size cap + intra-batch duplicate ids),
 * then rate limit, then apply.
 *
 * Validation runs FIRST so a malformed batch consumes no budget — it was never going to
 * be applied, and charging for it let a buggy client rate-limit itself out of the
 * mutations that would have succeeded. The budget is then charged per MUTATION (not per
 * batch), so batching cannot buy extra throughput over single sends.
 */
export const runSyncBatch = async ({
  mutations,
  req,
  scopeResolver,
  user,
}: {
  mutations: SyncMutateRequest[];
  req?: express.Request;
  scopeResolver?: SyncMutationScopeResolver;
  user: User;
}): Promise<SyncBatchRunResult> => {
  const validation = validateSyncMutationBatch(mutations);
  if (!validation.ok) {
    return {response: validation.response, stage: "validation"};
  }

  const userId = String(user.id);
  const retryAfterMs = consumeMutationBudget({userId, weight: mutations.length});
  if (retryAfterMs !== undefined) {
    logger.info("[sync] User hit the sync batch mutation rate limit", {
      batchSize: mutations.length,
      userId,
    });
    return {
      response: {
        results: [{nack: {mutationId: "", ...rateLimitNack(retryAfterMs)}, type: "nack"}],
      },
      stage: "rate_limited",
    };
  }

  return {
    response: await applySyncMutationBatch({mutations, req, scopeResolver, user}),
    stage: "applied",
  };
};
