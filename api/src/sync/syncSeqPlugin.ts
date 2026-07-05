// biome-ignore-all lint/suspicious/noExplicitAny: Schema/Query generics must be loose to accept arbitrary consumer schemas
import type {CallbackWithoutResultAndOptionalError, Model, Query, Schema} from "mongoose";
import {claimSyncSeqs} from "./models";
import {findSyncEntryByModelName, type SyncRegistryEntry} from "./registry";
import {getScopeField, resolveStreamForDoc, streamForScopeValue} from "./streams";

/**
 * Schema plugin for sync-enabled models. Stamps a monotonic per-stream `_syncSeq` on
 * every single-document write and records `_syncPrevStream` when a write moves the
 * document between scopes (owner/tenant change), so the change-stream watcher can
 * tombstone the old stream without MongoDB pre-images.
 *
 * Apply to the schema alongside `isDeletedPlugin`; activation is keyed off the sync
 * registry, so models that are not registered via modelRouter's `sync` option no-op.
 *
 * Sequencing guarantees:
 * - Validation failures never consume a seq: Mongoose runs validation before user
 *   pre('save') hooks, so the claim happens post-validation.
 * - The claim joins the caller's session when one is present, so caller-managed
 *   transactions get counter+write atomicity for free. Without a caller session the
 *   claim is a plain atomic `$inc`; a rare write failure after a claim burns a seq,
 *   which the client treats as a benign gap (rate-limited reconcile).
 * - `updateMany`, `deleteMany`, hard deletes, and `bulkWrite` are unsupported on
 *   synced models: multi-document writes cannot stamp per-document seqs, and hard
 *   deletes would be invisible to tombstone catch-up. All but `bulkWrite` throw
 *   (Model.bulkWrite bypasses middleware entirely — documented restriction).
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

  schema.pre("save", async function () {
    const entry = findSyncEntryByModelName((this.constructor as Model<any>).modelName);
    if (!entry) {
      return;
    }
    const currentStream = streamForObject(entry, this.toObject());
    let prevStream: string | null = null;
    if (!this.isNew) {
      const initialStream = this.$locals[INITIAL_STREAM_KEY] as string | undefined;
      if (initialStream && initialStream !== currentStream) {
        prevStream = initialStream;
      }
    }
    const seq = await claimSyncSeqs({session: this.$session() ?? null, stream: currentStream});
    this.set({_syncPrevStream: prevStream, _syncSeq: seq});
    // The just-saved stream becomes the baseline for the next save on this instance.
    this.$locals[INITIAL_STREAM_KEY] = currentStream;
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
          const lastSeq = await claimSyncSeqs({count: group.length, stream});
          group.forEach((doc, index) => {
            doc._syncPrevStream = null;
            doc._syncSeq = lastSeq - group.length + 1 + index;
          });
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
    const session = this.getOptions().session ?? null;
    // Mirror update semantics: query updates are NOT auto-filtered by isDeletedPlugin
    // (it only hooks find/findOne), so the lookup must see tombstones too.
    const filter: Record<string, unknown> = {...this.getFilter()};
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
    const seq = await claimSyncSeqs({session, stream: currentStream});

    if (isTrueReplacement || !hasOperators) {
      // True replacements and implicit-$set plain objects both take plain keys.
      rawUpdate._syncPrevStream = prevStream;
      rawUpdate._syncSeq = seq;
    } else {
      rawUpdate.$set = {...(rawUpdate.$set ?? {}), _syncPrevStream: prevStream, _syncSeq: seq};
    }
    this.setUpdate(rawUpdate);
  };

  schema.pre("updateOne", {document: false, query: true}, preQueryWrite);
  schema.pre("findOneAndUpdate", preQueryWrite);
  schema.pre("replaceOne", preQueryWrite);
  schema.pre("findOneAndReplace", preQueryWrite);

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
