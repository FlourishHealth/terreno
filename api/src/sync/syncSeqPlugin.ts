// biome-ignore-all lint/suspicious/noExplicitAny: Schema/Query generics must be loose to accept arbitrary consumer schemas
import type {
  CallbackWithoutResultAndOptionalError,
  ClientSession,
  Model,
  Query,
  Schema,
} from "mongoose";
import {logger} from "../logger";
import {claimSyncSeqs, confirmSyncSeqs, SyncScopeMove} from "./models";
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
 *
 * Scope moves (C4): when a write moves the document between streams, a durable
 * `SyncScopeMove` marker is written in the same op-scope, carrying a seq claimed from
 * the OLD stream's counter. The change-stream watcher and old-stream snapshot catch-up
 * tombstone the document from the marker (not the racy `_syncPrevStream` post-image),
 * so a racing second write can no longer erase the tombstone. `_syncPrevStream` is still
 * stamped (harmless), but the marker is the source of truth.
 *
 * Write restrictions:
 * - `updateMany`, `deleteMany`, hard deletes, and `bulkWrite` are unsupported on synced
 *   models (all but `bulkWrite` throw; `Model.bulkWrite` bypasses middleware).
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
 * C4: write the scope-move marker (claim a seq from the OLD stream so it orders in that
 * stream's frontier). Joins the caller session so the marker commits with the move.
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
  const claim = await claimSyncSeqs({session, stream: fromStream});
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
  // The marker's own seq on the old stream is confirmed immediately: the marker insert
  // above is the committing write for that claim.
  if (claim.registered) {
    await confirmSyncSeqs({seqs: claim.seqs, stream: fromStream}).catch((error: unknown) => {
      logger.error("[sync] Failed to confirm scope-move marker seq", {
        error: String(error),
        stream: fromStream,
      });
    });
  }
};

export const syncPlugin = (schema: Schema<any, any, any, any>): void => {
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

  const PENDING_CONFIRM_KEY = "_syncPendingConfirm";

  schema.pre("save", async function () {
    const entry = findSyncEntryByModelName((this.constructor as Model<any>).modelName);
    if (!entry) {
      return;
    }
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
    // Stash the claim so post('save') can confirm it once the write commits.
    this.$locals[PENDING_CONFIRM_KEY] = claim.registered
      ? {seqs: claim.seqs, stream: currentStream}
      : undefined;
    // C4: durable scope-move marker (claims + confirms its own seq on the OLD stream).
    if (prevStream) {
      await writeScopeMoveMarker({
        entityId: String(this._id),
        entry,
        fromStream: prevStream,
        session,
        toStream: currentStream,
      });
    }
    // The just-saved stream becomes the baseline for the next save on this instance.
    this.$locals[INITIAL_STREAM_KEY] = currentStream;
  });

  // C1: confirm the claimed seq once the document write commits, so the stable frontier
  // can advance past it. Document post('save') `this` is the saved document.
  schema.post("save", async function () {
    const confirm = this.$locals[PENDING_CONFIRM_KEY] as
      | {stream: string; seqs: number[]}
      | undefined;
    if (!confirm) {
      return;
    }
    this.$locals[PENDING_CONFIRM_KEY] = undefined;
    await confirmSyncSeqs({seqs: confirm.seqs, stream: confirm.stream}).catch((error: unknown) => {
      // Never fail the user write for a confirm error: the entry ages out via the lease.
      logger.error("[sync] Failed to confirm seq after save", {
        error: String(error),
        stream: confirm.stream,
      });
    });
  });

  schema.pre(
    "insertMany",
    async function (next: CallbackWithoutResultAndOptionalError, docs: Record<string, unknown>[]) {
      try {
        const model = this as unknown as Model<any>;
        const entry = findSyncEntryByModelName(model.modelName);
        if (!entry || !Array.isArray(docs) || docs.length === 0) {
          return next();
        }
        const byStream = new Map<string, Record<string, unknown>[]>();
        for (const doc of docs) {
          const stream = streamForObject(entry, doc);
          const group = byStream.get(stream) ?? [];
          group.push(doc);
          byStream.set(stream, group);
        }
        for (const [stream, group] of byStream) {
          const claim = await claimSyncSeqs({count: group.length, stream});
          group.forEach((doc, index) => {
            doc._syncPrevStream = null;
            doc._syncSeq = claim.seqs[index];
          });
          // insertMany commits the docs after this hook returns; confirm the claim so the
          // frontier advances. A crash between here and commit ages out via the lease.
          if (claim.registered) {
            await confirmSyncSeqs({seqs: claim.seqs, stream}).catch((error: unknown) => {
              logger.error("[sync] Failed to confirm insertMany seqs", {
                error: String(error),
                stream,
              });
            });
          }
        }
        return next();
      } catch (error: unknown) {
        return next(error as Error);
      }
    }
  );

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
      await writeScopeMoveMarker({
        entityId,
        entry,
        fromStream: prevStream,
        session,
        toStream: currentStream,
      }).catch((error: unknown) => {
        logger.error("[sync] Failed to write scope-move marker after query write", {
          error: String(error),
          fromStream: prevStream,
        });
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
