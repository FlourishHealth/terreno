// biome-ignore-all lint/suspicious/noExplicitAny: Schema/Query generics must be loose to accept arbitrary consumer schemas
import type {
  CallbackWithoutResultAndOptionalError,
  ClientSession,
  Model,
  Query,
  Schema,
} from "mongoose";
import {logger} from "../logger";
import {isVersionError} from "./executors";
import {claimSyncSeqs, confirmSyncSeqs, releaseSyncSeqs, SyncScopeMove} from "./models";
import {findSyncEntryByModelName, type SyncRegistryEntry} from "./registry";
import {getScopeField, resolveStreamForDoc, streamForScopeValue} from "./streams";

/**
 * Schema plugin for sync-enabled models. Stamps a monotonic per-stream `_syncSeq` on
 * every single-document write and records `_syncPrevStream` when a write moves the
 * document between scopes (owner/tenant change).
 *
 * Apply to the schema alongside `isDeletedPlugin`; activation is keyed off the sync
 * registry, so models that are not registered via modelRouter's `sync` option no-op.
 *
 * Sequencing guarantees (C1 — stable frontier):
 * - Validation failures never consume a seq: Mongoose runs validation before user
 *   pre('save') hooks, so the claim happens post-validation.
 * - Each claim registers the claimed seq on the counter's in-flight `pending` registry;
 *   the matching post-write hook (`confirmSyncSeqs`) clears it. Until confirmed, the
 *   stream's stable frontier holds below the claimed seq, so a snapshot/delta cursor
 *   never advances past a seq whose owning write has not yet committed. A crash between
 *   claim and confirm leaves a stale pending entry that ages out via the lease.
 * - The claim joins the caller's session when one is present; that path gets true
 *   counter+write atomicity and skips the pending registry entirely (no confirm due).
 * - Every write path claims in its pre hook and confirms in its POST hook — single saves,
 *   `insertMany` batches, and query-writes alike. Confirming before the documents commit
 *   would let a cursor advance past seqs that have not landed, permanently stranding those
 *   documents below every catch-up cursor.
 *
 * Scope moves (C4): when a write moves the document between streams, a durable
 * `SyncScopeMove` marker is written AFTER the move commits, carrying a seq claimed from
 * the OLD stream's counter. The change-stream watcher and old-stream snapshot catch-up
 * tombstone the document from the marker (not the racy `_syncPrevStream` post-image),
 * so a racing second write can no longer erase the tombstone. `_syncPrevStream` is still
 * stamped (harmless), but the marker is the source of truth. Writing the marker
 * post-commit keeps a failed write from leaving a phantom tombstone; the insert is
 * retried ({@link SCOPE_MOVE_MARKER_ATTEMPTS}) because a committed move whose marker is
 * lost can never be tombstoned on the old stream.
 *
 * Lost-update protection (Task 9.13): the plugin turns on Mongoose
 * `optimisticConcurrency`, so `doc.save()` on an existing document filters by the loaded
 * `__v` and throws a `VersionError` when another write landed in between. This closes the
 * read-compare-save TOCTOU window in `executeUpdate`'s `baseVersion` check — two clients
 * sending the same `baseVersion` concurrently now produce exactly one ack and one conflict
 * instead of two acks with one edit silently lost. The loser's already-claimed seq is
 * released (never stamped on anything), so the stream's frontier does not stall for the
 * pending-claim lease.
 *
 * Write restrictions:
 * - `updateMany`, `deleteMany`, hard deletes, and `bulkWrite` are unsupported on synced
 *   models and all throw. The first three are guarded here; `bulkWrite` bypasses
 *   middleware entirely, so `registerSync` replaces that static on the model instead.
 * - Query-writes MUST target a single document by `_id` (m9): a non-`_id` filter could
 *   match a different document than intended and stamp the wrong stream's seq.
 * - `upsert: true` is rejected on query-writes (m8/C6): an upsert can create a document
 *   the pre-write lookup never saw, escaping seq stamping.
 */

const INITIAL_STREAM_KEY = "_syncInitialStream";

/** Resolve the stream for a plain object under an entry's scope. */
const streamForObject = (entry: SyncRegistryEntry, obj: Record<string, unknown>): string =>
  resolveStreamForDoc({collectionTag: entry.collectionTag, doc: obj, scope: entry.config.scope});

const unsupportedWrite = (modelName: string, operation: string): Error =>
  new Error(
    `${operation} is not supported on sync-enabled model ${modelName}: per-document seq ` +
      "stamping requires single-document writes (and deletes must be soft). " +
      "Loop per document instead."
  );

/**
 * m9: a query-write on a synced model must target exactly one document by `_id`, so the
 * pre-write lookup resolves the stream of the SAME document the update mutates. A non-`_id`
 * filter can match a different document and stamp the wrong stream's seq (duplicate seqs
 * within a stream). Accept `{_id: value}` and `{_id: {$eq: value}}`.
 */
const filterTargetsSingleId = (filter: Record<string, unknown>): boolean => {
  const idClause = filter._id;
  if (idClause === undefined || idClause === null) {
    return false;
  }
  // A plain string/number id, or an ObjectId (or any BSON value — has a `_bsontype`),
  // is a direct single-document match.
  if (typeof idClause !== "object" || (idClause as {_bsontype?: unknown})._bsontype) {
    return true;
  }
  // A query-operator object is only single-document when it is exactly `{$eq: value}`.
  const keys = Object.keys(idClause as Record<string, unknown>);
  return keys.length === 1 && keys[0] === "$eq";
};

const nonIdFilterError = (modelName: string, operation: string): Error =>
  new Error(
    `${operation} on sync-enabled model ${modelName} must target a single document by _id ` +
      "(use findByIdAndUpdate or loop per document): a non-_id filter can stamp the wrong " +
      "stream's seq."
  );

const upsertError = (modelName: string, operation: string): Error =>
  new Error(
    `${operation} with upsert:true is not supported on sync-enabled model ${modelName}: an ` +
      "upsert can create a document the pre-write lookup never saw, escaping seq stamping."
  );

/**
 * C4: how many times a scope-move marker insert is attempted before giving up. Losing the
 * marker loses the old stream's tombstone forever (the exact race C4 exists to eliminate),
 * so a transient failure (replica step-down, transient network error) is retried.
 */
export const SCOPE_MOVE_MARKER_ATTEMPTS = 3;

/** Backoff between marker-write attempts. */
const SCOPE_MOVE_MARKER_RETRY_MS = 25;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * C4: write the scope-move marker (claim a seq from the OLD stream so it orders in that
 * stream's frontier). Runs AFTER the move commits, so it never leaves a phantom tombstone
 * for a write that failed; the insert is retried up to {@link SCOPE_MOVE_MARKER_ATTEMPTS}
 * times because the already-committed move cannot be undone if the marker is lost.
 *
 * Never throws: the owning write has already committed, so a marker failure is logged
 * rather than surfaced to the caller.
 */
const writeScopeMoveMarker = async ({
  entry,
  entityId,
  fromStream,
  toStream,
  session,
}: {
  entry: SyncRegistryEntry;
  entityId: string;
  fromStream: string;
  toStream: string;
  session: ClientSession | null;
}): Promise<void> => {
  let claim: Awaited<ReturnType<typeof claimSyncSeqs>>;
  try {
    claim = await claimSyncSeqs({session, stream: fromStream});
  } catch (error: unknown) {
    logger.error("[sync] Failed to claim scope-move marker seq", {
      entityId,
      error: String(error),
      fromStream,
    });
    return;
  }
  // Retry the insert with the SAME claimed seq so a retry cannot mint a second marker
  // ordered at a different point in the old stream.
  for (let attempt = 1; attempt <= SCOPE_MOVE_MARKER_ATTEMPTS; attempt++) {
    try {
      await SyncScopeMove.create(
        [
          {
            collectionTag: entry.collectionTag,
            entityId,
            fromStream,
            seq: claim.lastSeq,
            toStream,
          },
        ],
        session ? {session} : {}
      );
      // The marker's own seq on the old stream is confirmed once the insert lands: that
      // insert is the committing write for the claim.
      if (claim.registered) {
        await confirmSyncSeqs({seqs: claim.seqs, stream: fromStream}).catch((error: unknown) => {
          logger.error("[sync] Failed to confirm scope-move marker seq", {
            error: String(error),
            stream: fromStream,
          });
        });
      }
      return;
    } catch (error: unknown) {
      const exhausted = attempt === SCOPE_MOVE_MARKER_ATTEMPTS;
      logger.error("[sync] Failed to write scope-move marker", {
        attempt,
        entityId,
        error: String(error),
        exhausted,
        fromStream,
      });
      if (exhausted) {
        // The claim is left pending: the old stream's frontier holds below the missing
        // tombstone until the lease ages it out, rather than skipping it silently.
        return;
      }
      await delay(SCOPE_MOVE_MARKER_RETRY_MS);
    }
  }
};

/**
 * Task 9.17: the confirm found no pending entry, meaning this writer's claim was reaped as
 * abandoned (it stalled past {@link PENDING_CLAIM_LEASE_MS} without crashing) and the
 * frontier has already advanced past `reapedSeq`. The document just committed BELOW every
 * catch-up cursor, so re-stamp it with a freshly claimed seq: the raw-collection write
 * bypasses this plugin's hooks (no recursion, no second claim) while still producing a
 * change event, so online clients get a delta and offline ones see it on catch-up.
 *
 * Returns the new seq, or undefined when re-stamping failed (logged; the document stays
 * below the frontier and only a full re-bootstrap recovers it).
 */
const restampReapedSeq = async ({
  model,
  id,
  stream,
  reapedSeq,
}: {
  model: Model<any>;
  /** The document's RAW `_id` — the native driver does no casting, so a stringified
   * ObjectId would match nothing and silently leave the doc below the frontier. */
  id: unknown;
  stream: string;
  reapedSeq: number;
}): Promise<number | undefined> => {
  logger.error(
    "[sync] Seq claim was reaped before its write committed; re-stamping the document above " +
      "the frontier",
    {entityId: String(id), model: model.modelName, reapedSeq, stream}
  );
  try {
    const claim = await claimSyncSeqs({stream});
    const result = await model.collection.updateOne(
      {_id: id as any},
      {$set: {_syncSeq: claim.lastSeq}}
    );
    if ((result.matchedCount ?? 0) === 0) {
      logger.error("[sync] Re-stamp matched no document; releasing the re-stamp claim", {
        entityId: String(id),
        seq: claim.lastSeq,
        stream,
      });
      await releaseSyncSeqs({seqs: claim.seqs, stream});
      return undefined;
    }
    const confirmed = await confirmSyncSeqs({seqs: claim.seqs, stream});
    if (!confirmed.cleared) {
      // Two reaps in a row means the process is pathologically slow; stop recursing.
      logger.error("[sync] Re-stamped seq was itself reaped; document remains below the frontier", {
        entityId: String(id),
        seq: claim.lastSeq,
        stream,
      });
    }
    return claim.lastSeq;
  } catch (error: unknown) {
    logger.error("[sync] Failed to re-stamp a reaped seq", {
      entityId: String(id),
      error: String(error),
      reapedSeq,
      stream,
    });
    return undefined;
  }
};

export const syncPlugin = (schema: Schema<any, any, any, any>): void => {
  // Task 9.13: `doc.save()` must be conditional on the version the document was loaded at,
  // so the `baseVersion` comparison in executeUpdate cannot be defeated by a concurrent
  // save landing between the read and the write.
  if (!schema.options.versionKey) {
    throw new Error(
      "syncPlugin requires a versionKey on the schema: sync relies on Mongoose " +
        "optimisticConcurrency to make the baseVersion conflict check atomic. " +
        "Remove `versionKey: false` from the schema options."
    );
  }
  schema.set("optimisticConcurrency", true);

  schema.add({
    _syncPrevStream: {
      default: null,
      description:
        "The document's previous sync stream, set when a write moved it between scopes; " +
        "null when the last write did not move it",
      type: String,
    },
    _syncSeq: {
      description: "Monotonic per-stream sequence stamped on every synced write",
      index: true,
      type: Number,
    },
  });

  // Capture the stream the document belonged to when it was loaded, so scope moves can
  // be detected at save time without re-querying.
  schema.post("init", function () {
    const entry = findSyncEntryByModelName((this.constructor as Model<any>).modelName);
    if (!entry) {
      return;
    }
    this.$locals[INITIAL_STREAM_KEY] = streamForObject(entry, this.toObject());
  });

  const PENDING_COMMIT_KEY = "_syncPendingCommit";

  /** What `post("save")` must finish once the document write commits. */
  interface PendingSaveCommit {
    claim: {registered: boolean; seqs: number[]};
    currentStream: string;
    entityId: string;
    entry: SyncRegistryEntry;
    prevStream: string | null;
    session: ClientSession | null;
  }

  schema.pre("save", async function () {
    const entry = findSyncEntryByModelName((this.constructor as Model<any>).modelName);
    if (!entry) {
      return;
    }
    // A previous save on this instance that failed after this hook leaves its pending work
    // behind; drop it so this save's post hook never acts on the earlier attempt's claim.
    this.$locals[PENDING_COMMIT_KEY] = undefined;
    // m10: a save that changes nothing meaningful must not burn a seq or emit a delta.
    // Excluded from the "meaningful" set: the sync stamps this hook writes (`_syncSeq`,
    // `_syncPrevStream`) and auto-managed timestamp metadata (`updated`, which
    // createdUpdatedPlugin bumps on EVERY save — otherwise no save would ever be a
    // no-op). A save whose only modified paths are these is a no-op: skip the claim.
    if (!this.isNew) {
      const ignored = new Set(["_syncSeq", "_syncPrevStream", "updated"]);
      const meaningful = this.modifiedPaths().filter((p) => !ignored.has(p));
      if (meaningful.length === 0) {
        return;
      }
    }
    const session = this.$session() ?? null;
    const currentStream = streamForObject(entry, this.toObject());
    let prevStream: string | null = null;
    if (!this.isNew) {
      const initialStream = this.$locals[INITIAL_STREAM_KEY] as string | undefined;
      if (initialStream && initialStream !== currentStream) {
        prevStream = initialStream;
      }
    }
    const claim = await claimSyncSeqs({session, stream: currentStream});
    this.set({_syncPrevStream: prevStream, _syncSeq: claim.lastSeq});
    // Stash everything post-commit work needs: the seq confirm (C1) and the scope-move
    // marker (C4). Both MUST wait for the commit — a save that fails after this hook
    // (E11000, VersionError, a later user hook) must leave neither a confirmed seq nor a
    // phantom tombstone that old-stream clients would apply to a still-live document.
    const pending: PendingSaveCommit = {
      claim,
      currentStream,
      entityId: String(this._id),
      entry,
      prevStream,
      session,
    };
    this.$locals[PENDING_COMMIT_KEY] = pending;
  });

  // C1/C4: once the document write commits, confirm the claimed seq (so the stable
  // frontier can advance past it) and record the durable scope-move marker. Document
  // post('save') `this` is the saved document.
  schema.post("save", async function () {
    const pending = this.$locals[PENDING_COMMIT_KEY] as PendingSaveCommit | undefined;
    if (!pending) {
      return;
    }
    this.$locals[PENDING_COMMIT_KEY] = undefined;
    if (pending.claim.registered) {
      const confirmed = await confirmSyncSeqs({
        seqs: pending.claim.seqs,
        stream: pending.currentStream,
      }).catch((error: unknown) => {
        // Never fail the user write for a confirm error: the entry ages out via the lease.
        logger.error("[sync] Failed to confirm seq after save", {
          error: String(error),
          stream: pending.currentStream,
        });
        return {cleared: true};
      });
      if (!confirmed.cleared) {
        // Task 9.17: this writer's claim was reaped as abandoned while it was still
        // running, so the frontier already passed the seq we just committed.
        const restamped = await restampReapedSeq({
          id: this._id,
          model: this.constructor as Model<any>,
          reapedSeq: pending.claim.seqs[pending.claim.seqs.length - 1],
          stream: pending.currentStream,
        });
        if (restamped !== undefined) {
          // Reflect the durable seq on the in-memory document so the caller's ack (and
          // any serialization of this instance) reports the seq clients will actually see.
          this.$set("_syncSeq", restamped);
          this.unmarkModified("_syncSeq");
        }
      }
    }
    if (pending.prevStream) {
      await writeScopeMoveMarker({
        entityId: pending.entityId,
        entry: pending.entry,
        fromStream: pending.prevStream,
        session: pending.session,
        toStream: pending.currentStream,
      });
    }
    // The committed stream becomes the baseline for the next save on this instance; a
    // FAILED save keeps the old baseline so a retry still detects the move.
    this.$locals[INITIAL_STREAM_KEY] = pending.currentStream;
  });

  // Task 9.13: an optimistic-concurrency loss (`VersionError`) matched no document, so the
  // seq claimed in pre('save') will never be stamped on anything. Cancel it instead of
  // letting it hold the stable frontier down for the full pending-claim lease — a lost
  // update race is now an EXPECTED outcome, not a crash, and must not stall catch-up for
  // every other client on the stream.
  schema.post(
    "save",
    async function (error: any, doc: any, next: (err?: Error) => void): Promise<void> {
      const locals = (this?.$locals ?? doc?.$locals) as Record<string, unknown> | undefined;
      const pending = locals?.[PENDING_COMMIT_KEY] as PendingSaveCommit | undefined;
      if (locals) {
        locals[PENDING_COMMIT_KEY] = undefined;
      }
      if (pending?.claim.registered && isVersionError(error)) {
        await releaseSyncSeqs({seqs: pending.claim.seqs, stream: pending.currentStream}).catch(
          (releaseError: unknown) => {
            logger.error("[sync] Failed to release the seq claim of a version-conflicted save", {
              error: String(releaseError),
              stream: pending.currentStream,
            });
          }
        );
      }
      next(error);
    }
  );

  schema.pre(
    "insertMany",
    async function (
      next: CallbackWithoutResultAndOptionalError,
      docs: Record<string, unknown>[],
      options?: {session?: ClientSession | null}
    ) {
      try {
        const model = this as unknown as Model<any>;
        const entry = findSyncEntryByModelName(model.modelName);
        if (!entry || !Array.isArray(docs) || docs.length === 0) {
          return next();
        }
        const session = options?.session ?? null;
        const byStream = new Map<string, Record<string, unknown>[]>();
        for (const doc of docs) {
          const stream = streamForObject(entry, doc);
          const group = byStream.get(stream) ?? [];
          group.push(doc);
          byStream.set(stream, group);
        }
        for (const [stream, group] of byStream) {
          // The claim joins the caller's session so a transactional insertMany gets true
          // counter+write atomicity (and registers no pending entry to confirm).
          const claim = await claimSyncSeqs({count: group.length, session, stream});
          group.forEach((doc, index) => {
            doc._syncPrevStream = null;
            doc._syncSeq = claim.seqs[index];
          });
        }
        // C1: the confirm belongs in post('insertMany') — confirming here would let the
        // stable frontier (and therefore a snapshot cursor) advance past seqs whose
        // documents have not committed yet, stranding them below every catch-up cursor.
        return next();
      } catch (error: unknown) {
        return next(error as Error);
      }
    }
  );

  // C1: the batch has committed — confirm the claimed seqs so the frontier advances past
  // them. Post insertMany middleware receives the inserted (hydrated) documents, which
  // carry the seqs stamped in the pre hook.
  schema.post("insertMany", async function (docs: unknown) {
    if (!Array.isArray(docs) || docs.length === 0) {
      return;
    }
    const modelName = ((docs[0] as {constructor?: {modelName?: string}})?.constructor?.modelName ??
      (this as unknown as Model<any>).modelName) as string | undefined;
    const entry = modelName ? findSyncEntryByModelName(modelName) : undefined;
    if (!entry) {
      return;
    }
    const seqsByStream = new Map<string, number[]>();
    for (const doc of docs as Record<string, any>[]) {
      // A session-backed claim registered nothing to confirm, and a `$pull` issued outside
      // the caller's still-open transaction would conflict with its counter write.
      if (typeof doc?.$session === "function" && doc.$session()) {
        continue;
      }
      const obj = (typeof doc?.toObject === "function" ? doc.toObject() : doc) as Record<
        string,
        unknown
      >;
      const seq = obj._syncSeq;
      if (typeof seq !== "number") {
        continue;
      }
      const stream = streamForObject(entry, obj);
      const seqs = seqsByStream.get(stream) ?? [];
      seqs.push(seq);
      seqsByStream.set(stream, seqs);
    }
    for (const [stream, seqs] of seqsByStream) {
      await confirmSyncSeqs({seqs, stream}).catch((error: unknown) => {
        // Never fail the user write for a confirm error: the entries age out via the lease.
        logger.error("[sync] Failed to confirm insertMany seqs", {
          error: String(error),
          stream,
        });
      });
    }
  });

  // Single-document query writes: fetch the target to resolve its stream (and detect
  // scope moves), claim a seq, and merge the stamp into the update.
  const preQueryWrite = async function (this: Query<any, any>): Promise<void> {
    const model = this.model as Model<any>;
    const entry = findSyncEntryByModelName(model.modelName);
    if (!entry) {
      return;
    }
    const operation = (this as unknown as {op?: string}).op ?? "query-write";
    // m8/C6: reject upserts — an upsert can create a doc the lookup never saw.
    if (this.getOptions().upsert) {
      throw upsertError(model.modelName, operation);
    }
    const rawFilter = this.getFilter();
    // m9: refuse a non-single-_id filter — it could match a different doc than intended.
    if (!filterTargetsSingleId(rawFilter as Record<string, unknown>)) {
      throw nonIdFilterError(model.modelName, operation);
    }
    const session = this.getOptions().session ?? null;
    // Mirror update semantics: query updates are NOT auto-filtered by isDeletedPlugin
    // (it only hooks find/findOne), so the lookup must see tombstones too.
    const filter: Record<string, unknown> = {...rawFilter};
    if (filter.deleted === undefined) {
      filter.deleted = {$in: [true, false]};
    }
    const matches = await model
      .find(filter)
      .setOptions(session ? {session} : {})
      .limit(1);
    const target = matches[0];
    if (!target) {
      // The update matches nothing; let it proceed as a no-op.
      return;
    }
    const targetObj = target.toObject() as Record<string, unknown>;
    const previousStream = streamForObject(entry, targetObj);

    const rawUpdate = (this.getUpdate() ?? {}) as Record<string, any>;
    // Only replaceOne/findOneAndReplace replace the document. A plain object passed to
    // updateOne/findOneAndUpdate is an IMPLICIT $set in Mongoose — treating it as a
    // replacement would resolve the scope value as undefined and claim the wrong stream.
    const op = (this as unknown as {op?: string}).op ?? "";
    const isTrueReplacement = op === "replaceOne" || op === "findOneAndReplace";
    const hasOperators = Object.keys(rawUpdate).some((key) => key.startsWith("$"));
    // The fields the update effectively $sets (empty for true replacements).
    const setFields: Record<string, unknown> = isTrueReplacement
      ? {}
      : hasOperators
        ? ((rawUpdate.$set as Record<string, unknown>) ?? {})
        : rawUpdate;
    const scopeField = getScopeField(entry.config.scope);

    let currentStream: string;
    if (typeof entry.config.scope === "function") {
      const effectiveDoc = isTrueReplacement ? rawUpdate : {...targetObj, ...setFields};
      currentStream = streamForObject(entry, effectiveDoc);
    } else if (scopeField) {
      const newScopeValue = isTrueReplacement
        ? rawUpdate[scopeField]
        : (setFields[scopeField] ?? targetObj[scopeField]);
      currentStream = streamForScopeValue({
        collectionTag: entry.collectionTag,
        scope: entry.config.scope,
        scopeValue: newScopeValue,
      });
    } else {
      currentStream = previousStream;
    }

    const prevStream = previousStream !== currentStream ? previousStream : null;
    const claim = await claimSyncSeqs({session, stream: currentStream});

    if (isTrueReplacement || !hasOperators) {
      // True replacements and implicit-$set plain objects both take plain keys.
      rawUpdate._syncPrevStream = prevStream;
      rawUpdate._syncSeq = claim.lastSeq;
    } else {
      rawUpdate.$set = {
        ...(rawUpdate.$set ?? {}),
        _syncPrevStream: prevStream,
        _syncSeq: claim.lastSeq,
      };
    }
    this.setUpdate(rawUpdate);
    // Stash the claim + move info so the query post hook confirms/records after commit.
    (this as unknown as {_syncPendingConfirm?: unknown})._syncPendingConfirm = {
      claim,
      currentStream,
      entityId: String(target._id),
      entry,
      prevStream,
      session,
    };
  };

  // C1/C4: after the query write commits, confirm the claimed seq and record the
  // scope-move marker. Query post middleware `this` is the Query (not a document).
  const postQueryWrite = async function (this: Query<any, any>): Promise<void> {
    const pending = (this as unknown as {_syncPendingConfirm?: any})._syncPendingConfirm;
    if (!pending) {
      return;
    }
    (this as unknown as {_syncPendingConfirm?: unknown})._syncPendingConfirm = undefined;
    const {claim, currentStream, entityId, entry, prevStream, session} = pending as {
      claim: {registered: boolean; seqs: number[]};
      currentStream: string;
      entityId: string;
      entry: SyncRegistryEntry;
      prevStream: string | null;
      session: ClientSession | null;
    };
    if (claim.registered) {
      await confirmSyncSeqs({seqs: claim.seqs, stream: currentStream}).catch((error: unknown) => {
        logger.error("[sync] Failed to confirm seq after query write", {
          error: String(error),
          stream: currentStream,
        });
      });
    }
    if (prevStream) {
      // Retries internally and never throws: the move already committed, so the marker
      // must not be dropped on the first transient failure nor fail the user's write.
      await writeScopeMoveMarker({
        entityId,
        entry,
        fromStream: prevStream,
        session,
        toStream: currentStream,
      });
    }
  };

  schema.pre("updateOne", {document: false, query: true}, preQueryWrite);
  schema.pre("findOneAndUpdate", preQueryWrite);
  schema.pre("replaceOne", preQueryWrite);
  schema.pre("findOneAndReplace", preQueryWrite);
  schema.post("updateOne", {document: false, query: true}, postQueryWrite);
  schema.post("findOneAndUpdate", postQueryWrite);
  schema.post("replaceOne", postQueryWrite);
  schema.post("findOneAndReplace", postQueryWrite);

  // Unsupported multi-document / hard-delete paths throw for registered models.
  const guardQuery = (operation: string) =>
    function (this: Query<any, any>): void {
      const model = this.model as Model<any>;
      if (findSyncEntryByModelName(model.modelName)) {
        throw unsupportedWrite(model.modelName, operation);
      }
    };
  schema.pre("updateMany", guardQuery("updateMany"));
  schema.pre("deleteMany", guardQuery("deleteMany"));
  schema.pre("deleteOne", {document: false, query: true}, guardQuery("deleteOne"));
  schema.pre("findOneAndDelete", guardQuery("findOneAndDelete"));
  schema.pre("deleteOne", {document: true, query: false}, function () {
    const entry = findSyncEntryByModelName((this.constructor as Model<any>).modelName);
    if (entry) {
      throw unsupportedWrite(entry.modelName, "document deleteOne (hard delete)");
    }
  });
};
