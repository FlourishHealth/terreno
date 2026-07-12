// biome-ignore-all lint/suspicious/noExplicitAny: serialization operates generically across registered models
import type express from "express";

import type {SyncRegistryEntry} from "./registry";
import type {SyncMutationOperation} from "./types";

/**
 * Shared serializer for sync payloads (snapshot entities, conflict server docs, and
 * change-stream deltas), applying the fallback chain:
 *
 *   sync `responseHandler` > modelRouter `responseHandler` > `toJSON()` > raw object.
 *
 * Lives in its own module so both the HTTP routes/mutation handler and the realtime
 * change-stream watcher can import it without deepening the routes -> mutationHandler
 * import cycle. Accepts hydrated Mongoose documents and the raw BSON objects change
 * streams deliver (which have neither `toObject` nor `toJSON`).
 */
export const serializeSyncPayload = async ({
  entry,
  doc,
  method = "update",
  req,
}: {
  entry: SyncRegistryEntry;
  doc: Record<string, unknown>;
  method?: SyncMutationOperation;
  req: express.Request;
}): Promise<unknown> => {
  const plain =
    typeof (doc as any).toObject === "function"
      ? ((doc as any).toObject() as Record<string, unknown>)
      : doc;
  if (entry.config.responseHandler) {
    return entry.config.responseHandler(plain, method);
  }
  if (entry.options.responseHandler) {
    // C8: sync serializes a SINGLE entity (snapshot row, conflict doc, or delta), so the
    // modelRouter responseHandler must run with single-entity `"read"` semantics — not
    // the hardcoded `"list"`, which can trigger list-only shaping (field trimming, array
    // wrapping) that corrupts a single-doc payload.
    return entry.options.responseHandler(doc as any, "read", req, entry.options);
  }
  if (typeof (doc as any).toJSON === "function") {
    return (doc as any).toJSON();
  }
  return plain;
};
