// biome-ignore-all lint/suspicious/noExplicitAny: the mutation handler operates generically across registered models
import type express from "express";
import mongoose from "mongoose";
import type {User} from "../auth";
import {isAPIError} from "../errors";
import {logger} from "../logger";
import {findOneOrNoneFor} from "../plugins";
import {executeCreate, executeDelete, executeUpdate, isExecutorConflictError} from "./executors";
import {SyncMutation, type SyncMutationDocument} from "./models";
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
 * Another delivery claimed this mutationId: poll the ledger row until its status leaves
 * `pending` and return the recorded outcome. If it stays pending past the timeout, nack
 * `error` without modifying the row — the owning delivery will still finalize it.
 */
const waitForRecordedOutcome = async ({
  mutationId,
  user,
}: {
  mutationId: string;
  user: User;
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
    }
    await sleep(PENDING_POLL_INTERVAL_MS);
  }
  return makeNack({
    code: "error",
    message: `Mutation ${mutationId} is still in flight`,
    mutationId,
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

  // Atomic claim: inserting the pending row first means exactly one delivery applies.
  let claimed: SyncMutationDocument;
  try {
    claimed = await SyncMutation.create({
      mutationId,
      status: "pending",
      userId: String(user.id),
    });
  } catch (error: unknown) {
    if ((error as {code?: number}).code !== 11000) {
      throw error;
    }
    return waitForRecordedOutcome({mutationId, user});
  }

  const request = req ?? ({user} as unknown as express.Request);
  const model = mongoose.model(entry.modelName);
  try {
    let doc: mongoose.Document;
    if (mutation.operation === "create") {
      const body: Record<string, unknown> = {...(mutation.data ?? {})};
      if (mutation.id) {
        body._id = mutation.id;
      }
      ({doc} = await executeCreate({body, model, options: entry.options, req, user}));
    } else if (mutation.operation === "update") {
      ({doc} = await executeUpdate({
        body: mutation.data ?? {},
        concurrencyCheck: {baseSeq: mutation.baseVersion ?? 0, type: "seq"},
        id: mutation.id as string,
        model,
        options: entry.options,
        req,
        user,
      }));
    } else {
      ({doc} = await executeDelete({
        id: mutation.id as string,
        model,
        options: entry.options,
        req,
        user,
      }));
    }

    const resultId = String(doc._id);
    const resultSeq = (doc as unknown as {_syncSeq?: number})._syncSeq ?? 0;
    await SyncMutation.updateOne(
      {_id: claimed._id},
      {$set: {resultId, resultSeq, status: "applied"}}
    );
    logger.info("[sync] Mutation applied", {
      collection: mutation.collection,
      mutationId,
      seq: resultSeq,
    });
    return {ack: {id: resultId, mutationId, seq: resultSeq}, type: "ack"};
  } catch (error: unknown) {
    return finalizeNack({claimedId: claimed._id, entry, error, mutation, request});
  }
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
