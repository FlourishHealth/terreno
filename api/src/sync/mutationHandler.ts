// biome-ignore-all lint/suspicious/noExplicitAny: the mutation handler operates generically across registered models
import type express from "express";
import mongoose from "mongoose";
import type {User} from "../auth";
import {isAPIError} from "../errors";
import {logger} from "../logger";
import {findOneOrNoneFor} from "../plugins";
import {ExecutorConflictError, executeCreate, executeDelete, executeUpdate} from "./executors";
import {SyncMutation, type SyncMutationDocument} from "./models";
import {findSyncEntryByCollectionTag, type SyncRegistryEntry} from "./registry";
import {serializeSyncDoc} from "./routes";
import type {SyncAck, SyncMutateRequest, SyncNack, SyncNackCode} from "./types";

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
  if (error instanceof ExecutorConflictError) {
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
