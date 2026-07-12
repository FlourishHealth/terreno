// biome-ignore-all lint/suspicious/noExplicitAny: the mutation handler operates generically across registered models
import type express from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import type {User} from "../auth";
import {isAPIError} from "../errors";
import {logger} from "../logger";
import {findOneOrNoneFor} from "../plugins";
import {
  executeCreate,
  executeDelete,
  executeUpdate,
  isExecutorConflictError,
  runPostCreate,
  runPostDelete,
  runPostUpdate,
} from "./executors";
import {SYNC_MUTATION_LEASE_MS, SyncMutation, type SyncMutationDocument} from "./models";
import {findSyncEntryByCollectionTag, type SyncRegistryEntry} from "./registry";
import {serializeSyncDoc} from "./routes";
import type {
  SyncAck,
  SyncMutateBatchResponse,
  SyncMutateRequest,
  SyncNack,
  SyncNackCode,
} from "./types";

/**
 * Shared mutation handler for the sync channel: `POST /sync/mutate` (HTTP fallback)
 * and `sync:mutate` (socket) both delegate here.
 *
 * Idempotency (atomic claim): the handler inserts a SyncMutation ledger row with status
 * `pending` (unique index on mutationId) *before* applying. A duplicate-key error means
 * another delivery owns or already completed the mutation, so the handler polls the
 * existing row and returns the recorded outcome instead of re-applying — closing the
 * race where a socket retry and the HTTP fallback deliver the same mutation concurrently.
 *
 * Conflict rule: the client's `baseVersion` (the `_syncSeq` it last saw) is passed to
 * executeUpdate as a seq concurrency check; a mismatch yields a `conflict` nack carrying
 * the canonical serialized server document and its current seq.
 *
 * C5 crash resilience (FIX 6):
 * - **Lease/takeover (M4).** A `pending` row carries `claimedAt`. If a server crashes
 *   between claiming the row and finalizing it, the mutationId would otherwise be wedged
 *   for the full 30-day TTL. A duplicate-claim attempt older than
 *   {@link SYNC_MUTATION_LEASE_MS} may take over via an atomic
 *   `findOneAndUpdate({_id, status: "pending", claimedAt: {$lt: cutoff}}, {$set: {claimedAt: now}})`
 *   and re-run the mutation as the new claimant. Because the original attempt may have
 *   already landed the write before crashing, the executor path tolerates that: a create
 *   that hits E11000 on the SAME `_id` reads the doc back and reports it as the ack instead
 *   of nacking; an update/delete whose current server seq already reflects this mutation's
 *   expected post-write seq (`baseVersion + 1`) is treated as already-applied and reported
 *   from the current doc rather than re-executed (which would otherwise spuriously conflict
 *   against the write it is itself retrying).
 * - **Finalize-before-post-hooks (M5).** The pipeline is: document write → finalize the
 *   ledger `applied` (with the ack payload) → THEN run the model's post-hook
 *   (`postCreate`/`postUpdate`/`postDelete`). A post-hook throw is `logger.error`'d and
 *   reported back as an ack with a `warning` field — never converted into a nack, since the
 *   write (and its delta) already committed and rolling the client back would be a lie. If
 *   the `applied` finalize itself throws, the request is allowed to fail loudly (500); the
 *   client's transport retry lands on the lease-takeover path above, which resolves it from
 *   the ledger/doc state rather than double-applying.
 */

/** Outcome of applying a sync mutation: an ack for the client, or a typed nack. */
export type SyncMutationOutcome = {type: "ack"; ack: SyncAck} | {type: "nack"; nack: SyncNack};

const PENDING_POLL_ATTEMPTS = 10;
const PENDING_POLL_INTERVAL_MS = 100;
const VALID_OPERATIONS = new Set(["create", "update", "delete"]);

/** Maximum mutations accepted in a single `sync:mutateBatch` / `POST /sync/mutate/batch` request. */
export const MAX_SYNC_MUTATIONS_PER_BATCH = 100;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const makeNack = (nack: SyncNack): SyncMutationOutcome => {
  logger.info("[sync] Mutation nacked", {code: nack.code, mutationId: nack.mutationId});
  return {nack, type: "nack"};
};

/** Reconstruct the outcome recorded on a finalized ledger row; undefined while pending. */
const outcomeFromLedgerRow = (row: SyncMutationDocument): SyncMutationOutcome | undefined => {
  if (row.status === "applied") {
    return {
      ack: {id: row.resultId ?? "", mutationId: row.mutationId, seq: row.resultSeq ?? 0},
      type: "ack",
    };
  }
  if (row.status === "conflicted") {
    return makeNack({
      code: "conflict",
      message: row.error,
      mutationId: row.mutationId,
      serverDoc: row.serverDoc,
      serverSeq: row.resultSeq,
    });
  }
  if (row.status === "failed") {
    return makeNack({
      code: (row.nackCode as SyncNackCode) ?? "error",
      message: row.error,
      mutationId: row.mutationId,
    });
  }
  return undefined;
};

/**
 * C5 (FIX 6) lease takeover: a `pending` row older than {@link SYNC_MUTATION_LEASE_MS}
 * is assumed abandoned (the original claimant crashed between claiming the row and
 * finalizing it) — atomically re-claim it via `findOneAndUpdate` so exactly one
 * concurrent delivery wins the takeover. Returns the re-claimed row (with a bumped
 * `claimedAt`) on success, or `undefined` if the row is not stale/pending (someone else
 * is actively working it, or it already finalized).
 */
const takeoverStaleLease = async (
  mutationId: string
): Promise<SyncMutationDocument | undefined> => {
  const cutoff = DateTime.now().minus({milliseconds: SYNC_MUTATION_LEASE_MS}).toJSDate();
  const claimed = await SyncMutation.findOneAndUpdate(
    {claimedAt: {$lt: cutoff}, mutationId, status: "pending"},
    {$set: {claimedAt: new Date()}},
    {new: true}
  );
  return claimed ?? undefined;
};

/**
 * Another delivery claimed this mutationId: poll the ledger row until its status leaves
 * `pending` and return the recorded outcome. Before each poll, attempt a lease takeover
 * (C5/FIX 6) — a `pending` row older than {@link SYNC_MUTATION_LEASE_MS} is assumed
 * abandoned by a crashed claimant, so this delivery re-claims and re-applies it instead
 * of waiting out the full poll budget (or worse, the 30-day TTL). If the row stays
 * pending and un-stale past the timeout, nack `error` without modifying the row — the
 * owning delivery will still finalize it.
 */
const waitForRecordedOutcome = async ({
  mutationId,
  user,
  onTakeover,
}: {
  mutationId: string;
  user: User;
  /** Invoked with the re-claimed row when a stale lease is taken over. */
  onTakeover: (row: SyncMutationDocument) => Promise<SyncMutationOutcome>;
}): Promise<SyncMutationOutcome> => {
  for (let attempt = 0; attempt < PENDING_POLL_ATTEMPTS; attempt++) {
    const row = await findOneOrNoneFor(SyncMutation, {mutationId});
    if (row) {
      if (String(row.userId) !== String(user.id)) {
        return makeNack({
          code: "unauthorized",
          message: `Mutation ${mutationId} was submitted by another user`,
          mutationId,
        });
      }
      const outcome = outcomeFromLedgerRow(row);
      if (outcome) {
        return outcome;
      }
      if (row.status === "pending") {
        const takenOver = await takeoverStaleLease(mutationId);
        if (takenOver) {
          logger.warn("[sync] Took over a stale mutation lease", {
            mutationId,
            staleForMs: Date.now() - new Date(row.claimedAt).getTime(),
          });
          return onTakeover(takenOver);
        }
      }
    }
    await sleep(PENDING_POLL_INTERVAL_MS);
  }
  return makeNack({
    code: "error",
    message: `Mutation ${mutationId} is still in flight`,
    mutationId,
  });
};

/**
 * C5 (FIX 6): true when `error` is (or wraps, via `APIError.error` — see
 * `executeCreate`'s `model.create()` catch, which wraps the raw Mongo driver
 * error in an APIError before it ever reaches the caller) a MongoDB E11000
 * duplicate-key error.
 */
const isE11000Error = (error: unknown): boolean => {
  const candidate = error as {code?: number; error?: unknown};
  if (candidate?.code === 11000) {
    return true;
  }
  const wrapped = candidate?.error as {code?: number} | undefined;
  return wrapped?.code === 11000;
};

/**
 * C5 (FIX 6): true when every key/value in `data` (the mutation's own
 * intended write) is already present on `doc` — used alongside the
 * expected-post-write-seq check to distinguish "this mutation's own write
 * already landed" (safe to report as already-applied) from "a genuinely
 * different write landed and happens to have advanced the seq by exactly
 * one" (a real conflict; a seq match alone cannot tell these apart).
 */
const docMatchesMutationData = (
  doc: unknown,
  data: Record<string, unknown> | undefined
): boolean => {
  if (!data) {
    return true;
  }
  const asDocument = doc as {toObject?: () => Record<string, unknown>} | undefined;
  const plain =
    typeof asDocument?.toObject === "function"
      ? asDocument.toObject()
      : (doc as Record<string, unknown>);
  return Object.entries(data).every(([key, value]) => {
    const current = plain?.[key];
    if (current instanceof Date && typeof value === "string") {
      return current.toISOString() === new Date(value).toISOString();
    }
    return JSON.stringify(current) === JSON.stringify(value);
  });
};

const nackCodeForError = (error: unknown): SyncNackCode => {
  if (!isAPIError(error)) {
    return "error";
  }
  if (error.status === 403 || error.status === 405) {
    return "unauthorized";
  }
  if (error.status === 400 || error.status === 404 || error.status === 422) {
    return "validation";
  }
  return "error";
};

/** Record a failed/conflicted outcome on the claimed ledger row and build the nack. */
const finalizeNack = async ({
  claimedId,
  entry,
  error,
  mutation,
  request,
}: {
  claimedId: mongoose.Types.ObjectId;
  entry: SyncRegistryEntry;
  error: unknown;
  mutation: SyncMutateRequest;
  request: express.Request;
}): Promise<SyncMutationOutcome> => {
  // Duck-typed: `instanceof` breaks for Error subclasses in the compiled ES5 dist.
  if (isExecutorConflictError(error)) {
    let serverDoc: unknown;
    try {
      serverDoc = await serializeSyncDoc({
        doc: error.doc as mongoose.Document,
        entry,
        req: request,
      });
    } catch (serializeError: unknown) {
      logger.warn("[sync] Failed to serialize conflict server doc", {
        error: String(serializeError),
        mutationId: mutation.mutationId,
      });
    }
    await SyncMutation.updateOne(
      {_id: claimedId},
      {
        $set: {
          error: error.title,
          nackCode: "conflict",
          resultSeq: error.serverSeq,
          serverDoc,
          status: "conflicted",
        },
      }
    );
    return makeNack({
      code: "conflict",
      message: error.title,
      mutationId: mutation.mutationId,
      serverDoc,
      serverSeq: error.serverSeq,
    });
  }

  const code = nackCodeForError(error);
  const message = isAPIError(error) ? error.title : String(error);
  if (code === "error") {
    logger.warn("[sync] Mutation failed unexpectedly", {
      collection: mutation.collection,
      error: message,
      mutationId: mutation.mutationId,
    });
  }
  await SyncMutation.updateOne(
    {_id: claimedId},
    {$set: {error: message, nackCode: code, status: "failed"}}
  );
  return makeNack({code, message, mutationId: mutation.mutationId});
};

/**
 * C5 (FIX 6): read the doc back and report it as the ack for an ALREADY-APPLIED write —
 * used both by the create-E11000 tolerance and the update/delete already-applied check.
 * Finalizes the ledger `applied` from the doc's actual state (not assumed) before
 * returning, exactly like the normal apply path, so a subsequent duplicate delivery
 * reads back the same outcome.
 */
const finalizeAlreadyApplied = async ({
  claimedId,
  doc,
  mutation,
}: {
  claimedId: mongoose.Types.ObjectId;
  doc: mongoose.Document;
  mutation: SyncMutateRequest;
}): Promise<{resultId: string; resultSeq: number}> => {
  const resultId = String(doc._id);
  const resultSeq = (doc as unknown as {_syncSeq?: number})._syncSeq ?? 0;
  await SyncMutation.updateOne({_id: claimedId}, {$set: {resultId, resultSeq, status: "applied"}});
  logger.info("[sync] Mutation already applied (lease-takeover tolerance)", {
    collection: mutation.collection,
    mutationId: mutation.mutationId,
    seq: resultSeq,
  });
  return {resultId, resultSeq};
};

/**
 * Apply a client mutation through the transport-agnostic executors (permissions,
 * pre/post hooks, validation) against an ALREADY-CLAIMED ledger row (either a fresh claim
 * or a lease takeover of an abandoned one — C5/FIX 6). Always finalizes the claimed row
 * before returning so duplicate deliveries can read the outcome back.
 *
 * Reorder (M5): the document write finalizes the ledger `applied` BEFORE the model's
 * post-hook runs. A post-hook throw is logged and reported as a `warning` on the ack —
 * never converted into a nack, since the write already committed.
 *
 * Already-applied tolerance (M4, `isLeaseTakeover` only — a normal first attempt reports
 * genuine conflicts/errors as usual): a lease takeover re-runs a mutation whose FIRST
 * attempt may have already landed the write before crashing.
 * - create: an E11000 on the same target `_id` is treated as success — the doc is read
 *   back and reported as the ack (a genuine `_id` collision from a DIFFERENT mutation is
 *   not expected for client-minted ids and is out of scope here).
 * - update: re-checked reactively — if the executor's seq concurrency check throws a
 *   conflict whose `serverSeq` is EXACTLY `baseVersion + 1` (what this mutation's own
 *   write would have produced) while retrying via a lease takeover, that is treated as
 *   "this exact write already landed" rather than a genuine external conflict, and the
 *   current doc is reported as the ack instead of nacking.
 * - delete: idempotent already (executeDelete on an already-deleted tombstone is a no-op
 *   success in this codebase's soft-delete model), so no special tolerance is needed.
 */
const applyClaimedMutation = async ({
  claimed,
  entry,
  mutation,
  request,
  user,
  isLeaseTakeover = false,
}: {
  claimed: SyncMutationDocument;
  entry: SyncRegistryEntry;
  mutation: SyncMutateRequest;
  request: express.Request;
  user: User;
  /** True when `claimed` was re-claimed from a stale lease rather than freshly inserted. */
  isLeaseTakeover?: boolean;
}): Promise<SyncMutationOutcome> => {
  const mutationId = mutation.mutationId;
  const model = mongoose.model(entry.modelName);

  try {
    let doc: mongoose.Document;
    let postHook: (() => Promise<void>) | undefined;
    if (mutation.operation === "create") {
      const body: Record<string, unknown> = {...(mutation.data ?? {})};
      if (mutation.id) {
        body._id = mutation.id;
      }
      try {
        const result = await executeCreate({
          body,
          model,
          options: entry.options,
          req: request,
          skipPostHooks: true,
          user,
        });
        doc = result.doc;
        postHook = (): Promise<void> =>
          runPostCreate({doc: result.doc, options: entry.options, request});
      } catch (createError: unknown) {
        // M4 (lease takeover only): an E11000 on the exact target _id is
        // tolerated as "already applied" — a prior (crashed) attempt at
        // THIS mutation landed the write before finalizing the ledger. A
        // normal (non-takeover) first attempt reports the error as usual —
        // client-minted UUIDs make a genuine unrelated _id collision
        // vanishingly unlikely, so gating this on isLeaseTakeover keeps the
        // tolerance scoped to its actual crash-recovery purpose.
        if (isLeaseTakeover && isE11000Error(createError) && typeof mutation.id === "string") {
          const existing = await findOneOrNoneFor(model, {_id: mutation.id});
          if (existing) {
            const {resultId, resultSeq} = await finalizeAlreadyApplied({
              claimedId: claimed._id,
              doc: existing as unknown as mongoose.Document,
              mutation,
            });
            return {ack: {id: resultId, mutationId, seq: resultSeq}, type: "ack"};
          }
        }
        throw createError;
      }
    } else if (mutation.operation === "update") {
      try {
        const result = await executeUpdate({
          body: mutation.data ?? {},
          concurrencyCheck: {baseSeq: mutation.baseVersion ?? 0, type: "seq"},
          id: mutation.id as string,
          model,
          options: entry.options,
          req: request,
          skipPostHooks: true,
          user,
        });
        doc = result.doc;
        // biome-ignore lint/style/noNonNullAssertion: executeUpdate with skipPostHooks always returns cleanedBody/prevDoc.
        const cleanedBody = result.cleanedBody!;
        // biome-ignore lint/style/noNonNullAssertion: executeUpdate with skipPostHooks always returns cleanedBody/prevDoc.
        const prevDoc = result.prevDoc!;
        postHook = (): Promise<void> =>
          runPostUpdate({cleanedBody, doc: result.doc, options: entry.options, prevDoc, request});
      } catch (updateError: unknown) {
        // M4 (lease takeover only): a conflict whose serverSeq is EXACTLY
        // this mutation's own expected post-write seq COULD mean the write
        // this very mutation intended already landed on a prior (crashed)
        // attempt — but a seq match alone is ambiguous (any other write
        // landing between the claim and the retry would also bump the seq
        // by exactly one). Additionally require the current doc's fields to
        // already contain every value this mutation's own `data` would have
        // written — only THEN is it safe to treat as already-applied and
        // report success; otherwise it is a genuine external conflict and
        // must nack as usual, exactly like a normal (non-takeover) apply.
        if (
          isLeaseTakeover &&
          isExecutorConflictError(updateError) &&
          updateError.conflictType === "seq" &&
          updateError.serverSeq === (mutation.baseVersion ?? 0) + 1 &&
          docMatchesMutationData(updateError.doc, mutation.data)
        ) {
          const {resultId, resultSeq} = await finalizeAlreadyApplied({
            claimedId: claimed._id,
            doc: updateError.doc as mongoose.Document,
            mutation,
          });
          return {ack: {id: resultId, mutationId, seq: resultSeq}, type: "ack"};
        }
        throw updateError;
      }
    } else {
      const result = await executeDelete({
        id: mutation.id as string,
        model,
        options: entry.options,
        req: request,
        skipPostHooks: true,
        user,
      });
      doc = result.doc;
      postHook = (): Promise<void> =>
        runPostDelete({doc: result.doc, options: entry.options, request});
    }

    const resultId = String(doc._id);
    const resultSeq = (doc as unknown as {_syncSeq?: number})._syncSeq ?? 0;
    // M5: finalize the ledger BEFORE the post-hook runs — a post-hook throw
    // must never make a committed write look like a failure.
    await SyncMutation.updateOne(
      {_id: claimed._id},
      {$set: {resultId, resultSeq, status: "applied"}}
    );
    logger.info("[sync] Mutation applied", {
      collection: mutation.collection,
      mutationId,
      seq: resultSeq,
    });

    let warning: string | undefined;
    if (postHook) {
      try {
        await postHook();
      } catch (postHookError: unknown) {
        warning = errorMessageOf(postHookError);
        logger.error("[sync] Post-hook failed after a committed mutation", {
          collection: mutation.collection,
          error: warning,
          mutationId,
        });
      }
    }
    return {
      ack: {id: resultId, mutationId, seq: resultSeq, ...(warning ? {warning} : {})},
      type: "ack",
    };
  } catch (error: unknown) {
    return finalizeNack({claimedId: claimed._id, entry, error, mutation, request});
  }
};

const errorMessageOf = (error: unknown): string =>
  isAPIError(error) ? error.title : error instanceof Error ? error.message : String(error);

/**
 * Apply a client mutation through the transport-agnostic executors (permissions,
 * pre/post hooks, validation) with an atomic idempotency claim. Always finalizes the
 * claimed ledger row before returning so duplicate deliveries can read the outcome back.
 */
export const applySyncMutation = async ({
  user,
  mutation,
  req,
}: {
  user: User;
  mutation: SyncMutateRequest;
  /** The real Express request when called over HTTP; hooks receive a `{user}` stub otherwise. */
  req?: express.Request;
}): Promise<SyncMutationOutcome> => {
  const mutationId = typeof mutation?.mutationId === "string" ? mutation.mutationId : "";
  const validationNack = (message: string): SyncMutationOutcome =>
    makeNack({code: "validation", message, mutationId});

  if (!mutationId) {
    return validationNack("mutationId is required");
  }
  if (!mutation.collection || typeof mutation.collection !== "string") {
    return validationNack("collection is required");
  }
  if (!VALID_OPERATIONS.has(mutation.operation)) {
    return validationNack(`Unknown operation: ${String(mutation.operation)}`);
  }
  if ((mutation.operation === "update" || mutation.operation === "delete") && !mutation.id) {
    return validationNack(`id is required for ${mutation.operation} mutations`);
  }

  const entry = findSyncEntryByCollectionTag(mutation.collection);
  if (!entry) {
    return validationNack(`Unknown sync collection: ${mutation.collection}`);
  }

  const request = req ?? ({user} as unknown as express.Request);

  // Atomic claim: inserting the pending row first means exactly one delivery applies.
  let claimed: SyncMutationDocument;
  try {
    claimed = await SyncMutation.create({
      claimedAt: new Date(),
      mutationId,
      status: "pending",
      userId: String(user.id),
    });
  } catch (error: unknown) {
    if ((error as {code?: number}).code !== 11000) {
      throw error;
    }
    return waitForRecordedOutcome({
      mutationId,
      onTakeover: (takenOver) =>
        applyClaimedMutation({
          claimed: takenOver,
          entry,
          isLeaseTakeover: true,
          mutation,
          request,
          user,
        }),
      user,
    });
  }

  return applyClaimedMutation({claimed, entry, mutation, request, user});
};

/** Outcome of a batch validation pre-check (before any mutation is attempted). */
export type SyncBatchValidationOutcome =
  | {ok: true}
  | {ok: false; response: SyncMutateBatchResponse};

/**
 * Up-front validation shared by both batch transports (HTTP and socket): reject an
 * oversized batch or one with intra-batch duplicate mutationIds before anything is
 * applied. On failure, returns a single-element `results` array carrying a
 * `validation` nack for the offending mutation (or an empty-batch guard) — mirroring
 * the shape callers expect from `applySyncMutationBatch`, but produced without
 * touching the idempotency ledger since nothing was attempted.
 */
export const validateSyncMutationBatch = (
  mutations: SyncMutateRequest[]
): SyncBatchValidationOutcome => {
  if (mutations.length > MAX_SYNC_MUTATIONS_PER_BATCH) {
    return {
      ok: false,
      response: {
        results: [
          makeNack({
            code: "validation",
            message: `Batch of ${mutations.length} exceeds the maximum of ${MAX_SYNC_MUTATIONS_PER_BATCH} mutations`,
            mutationId: "",
          }) as {type: "nack"; nack: SyncNack},
        ],
      },
    };
  }
  const seen = new Set<string>();
  for (const mutation of mutations) {
    const mutationId = typeof mutation?.mutationId === "string" ? mutation.mutationId : "";
    if (mutationId && seen.has(mutationId)) {
      return {
        ok: false,
        response: {
          results: [
            makeNack({
              code: "validation",
              message: `Duplicate mutationId within batch: ${mutationId}`,
              mutationId,
            }) as {type: "nack"; nack: SyncNack},
          ],
        },
      };
    }
    seen.add(mutationId);
  }
  return {ok: true};
};

/**
 * Apply a batch of mutations strictly serially, in array order, reusing
 * `applySyncMutation` per item — full reuse of the idempotency ledger, executors,
 * permissions, and delta emission. Stops immediately at the first non-ack outcome
 * (the user's hard requirement, INV-1): mutations after it are neither attempted nor
 * ledgered, and are safe for the client to resend later (INV-3).
 *
 * Callers MUST run {@link validateSyncMutationBatch} first (oversized/duplicate
 * rejection happens before any mutation is attempted); this function assumes the
 * batch already passed that check.
 */
export const applySyncMutationBatch = async ({
  user,
  mutations,
  req,
}: {
  user: User;
  mutations: SyncMutateRequest[];
  /** The real Express request when called over HTTP; hooks receive a `{user}` stub otherwise. */
  req?: express.Request;
}): Promise<SyncMutateBatchResponse> => {
  const results: SyncMutateBatchResponse["results"] = [];
  for (const mutation of mutations) {
    const outcome = await applySyncMutation({mutation, req, user});
    results.push(outcome);
    if (outcome.type === "nack") {
      // Stop-on-error: the client re-sends everything after this point, and
      // INV-3's idempotency ledger makes that overlap safe.
      break;
    }
  }
  return {results};
};
