// biome-ignore-all lint/suspicious/noExplicitAny: sync routes operate generically across registered models
import express from "express";
import mongoose from "mongoose";
import {asyncHandler} from "../api";
import {authenticateMiddleware, type User} from "../auth";
import {APIError, apiErrorMiddleware} from "../errors";
import {checkPermissions} from "../permissions";
import {
  computeStableFrontier,
  getOrCreateSyncKeyMaterial,
  SyncCounter,
  SyncScopeMove,
  type SyncScopeMoveDocument,
} from "./models";
import {
  applySyncMutation,
  applySyncMutationBatch,
  MAX_SYNC_MUTATIONS_PER_BATCH,
  validateSyncMutationBatch,
} from "./mutationHandler";
import {findSyncEntryByCollectionTag, getSyncRegistry, type SyncRegistryEntry} from "./registry";
import {serializeSyncPayload} from "./serialize";
import {getScopeField, parseStreamKey, resolveUserStreamsForEntry} from "./streams";
import type {
  SyncEntityPayload,
  SyncMutateBatchRequest,
  SyncMutateRequest,
  SyncNackCode,
  SyncSnapshotResponse,
  SyncStreamInfo,
  SyncStreamsResponse,
} from "./types";

/** Maximum `POST /sync/mutate` and `/sync/mutate/batch` requests per user per second (HTTP). */
export const MAX_SYNC_HTTP_MUTATIONS_PER_SECOND = 100;

/**
 * Rolling one-second per-user mutation counter for the HTTP mutate routes, mirroring
 * the socket path's rate limit (which counts each mutation in a batch, not each
 * request/batch itself). Module-level so it survives across requests on the same
 * process; per-userId windows keep one heavy user from limiting another.
 */
const httpMutationWindows = new Map<string, {windowStart: number; count: number}>();

/**
 * Returns true when `weight` more mutations would exceed the per-second budget for
 * `userId`, WITHOUT consuming budget (callers decide whether to still count it).
 */
const wouldExceedHttpMutationRateLimit = (userId: string, weight: number): boolean => {
  const now = Date.now();
  const entry = httpMutationWindows.get(userId);
  if (!entry || now - entry.windowStart >= 1000) {
    return weight > MAX_SYNC_HTTP_MUTATIONS_PER_SECOND;
  }
  return entry.count + weight > MAX_SYNC_HTTP_MUTATIONS_PER_SECOND;
};

/** Consume `weight` mutations from the user's rolling one-second HTTP window. */
const consumeHttpMutationRateLimit = (userId: string, weight: number): void => {
  const now = Date.now();
  const entry = httpMutationWindows.get(userId);
  if (!entry || now - entry.windowStart >= 1000) {
    httpMutationWindows.set(userId, {count: weight, windowStart: now});
    return;
  }
  entry.count += weight;
};

/** Milliseconds remaining in `userId`'s current rate-limit window, for `retryAfterMs`. */
const httpMutationRateLimitRetryAfterMs = (userId: string): number => {
  const entry = httpMutationWindows.get(userId);
  if (!entry) {
    return 1000;
  }
  return Math.max(0, 1000 - (Date.now() - entry.windowStart));
};

/** Options for the SyncApp plugin's HTTP routes. */
export interface SyncAppOptions {
  /**
   * Resolve the scope values a user belongs to for tenant-scoped models
   * (e.g. the user's organization ids). Required when any registered model uses a
   * tenant scope.
   */
  getUserScopes?: (user: User, entry: SyncRegistryEntry) => Promise<string[]> | string[];
  /** Default page size for snapshots (default 500, max 1000). */
  defaultSnapshotLimit?: number;
}

const MAX_SNAPSHOT_LIMIT = 1000;
const DEFAULT_SNAPSHOT_LIMIT = 500;

/** HTTP status for each nack code returned by `POST /sync/mutate`. */
const NACK_HTTP_STATUS: Record<SyncNackCode, number> = {
  conflict: 409,
  error: 500,
  rate_limited: 429,
  unauthorized: 403,
  validation: 422,
};

/**
 * Serialize a document for a sync payload through the fallback chain:
 * sync responseHandler > modelRouter responseHandler > toJSON.
 * Delegates to the shared `serializeSyncPayload` (also used for `sync:delta` emission).
 */
export const serializeSyncDoc = async ({
  entry,
  doc,
  req,
}: {
  entry: SyncRegistryEntry;
  doc: mongoose.Document;
  req: express.Request;
}): Promise<unknown> =>
  serializeSyncPayload({doc: doc as unknown as Record<string, unknown>, entry, req});

/**
 * C2: build the server-enforced scope filter for a SINGLE stream. The stream's scope
 * value has already been verified against the user's membership set by the caller, so
 * this filters to exactly that one value (`{field: value}`), never an `$in`.
 *
 * Custom-resolver scopes cannot be inverted into a query field, so they still route
 * through the required `snapshotFilter` (parameterized by the user, as before).
 */
export const buildSnapshotScopeFilter = ({
  entry,
  scopeValue,
  snapshotFilterResult,
}: {
  entry: SyncRegistryEntry;
  scopeValue: string | null;
  snapshotFilterResult?: Record<string, unknown>;
}): Record<string, unknown> => {
  const {scope} = entry.config;
  if (typeof scope === "function") {
    // Custom scope: snapshotFilter is required at registration.
    if (!snapshotFilterResult) {
      throw new APIError({
        status: 500,
        title: `Sync collection ${entry.collectionTag} has a custom scope without a snapshotFilter`,
      });
    }
    return snapshotFilterResult;
  }
  if (scope.type === "broadcast") {
    return {};
  }
  const field = getScopeField(scope) as string;
  return {[field]: scopeValue};
};

const parseNonNegativeInt = (raw: unknown, name: string, fallback: number): number => {
  if (raw === undefined) {
    return fallback;
  }
  const value = Number.parseInt(String(raw), 10);
  if (Number.isNaN(value) || value < 0) {
    throw new APIError({status: 400, title: `Invalid ${name}: ${String(raw)}`});
  }
  return value;
};

/**
 * C3: page the legacy (seq-0) stratum by `_id`. Legacy documents predate `syncPlugin`
 * and carry no `_syncSeq` (or a literal 0). Returns a page + a forward `legacyCursor`
 * while the stratum has more; returns `undefined` once the stratum is exhausted, at
 * which point the caller switches to normal seq paging. Runs the same per-doc read
 * check as the seq page (C6/M2).
 */
const pageLegacyStratum = async ({
  model,
  scopeFilter,
  legacyCursorIn,
  limit,
  entry,
  req,
}: {
  model: any;
  scopeFilter: Record<string, unknown>;
  legacyCursorIn?: string;
  limit: number;
  entry: SyncRegistryEntry;
  req: express.Request;
}): Promise<{entities: SyncEntityPayload[]; legacyCursor: string} | undefined> => {
  const user = req.user as User | undefined;
  // `deleted` MUST stay a TOP-LEVEL key so isDeletedPlugin does not re-inject its
  // {deleted: {$ne: true}} exclusion (which only fires when the top-level filter has no
  // `deleted` key) and hide legacy tombstones. See the seq-page query for the full note.
  const legacyFilter: Record<string, unknown> = {
    $and: [
      scopeFilter,
      {_syncSeq: {$in: [null, 0]}},
      ...(legacyCursorIn ? [{_id: {$gt: new mongoose.Types.ObjectId(legacyCursorIn)}}] : []),
    ],
    deleted: {$in: [true, false]},
  };
  const docs = await model
    .find(legacyFilter)
    .sort({_id: 1})
    .limit(limit + 1);
  if (docs.length === 0) {
    // Stratum exhausted (or never had legacy docs) — caller proceeds by seq.
    return undefined;
  }
  const page = docs.slice(0, limit);
  const entities: SyncEntityPayload[] = [];
  for (const doc of page) {
    if (!(await checkPermissions("read", entry.options.permissions.read, user, doc))) {
      continue;
    }
    entities.push({
      data: await serializeSyncDoc({doc, entry, req}),
      deleted: Boolean(doc.deleted),
      id: String(doc._id),
      seq: 0,
    });
  }
  const lastId = String(page[page.length - 1]._id);
  return {entities, legacyCursor: lastId};
};

/**
 * C7: the lowest `_syncSeq` still retained for this stream (the retention floor). A
 * client whose stored cursor is below this may have missed compacted tombstones and must
 * re-bootstrap. Computed as the minimum seq present among the stream's non-legacy docs
 * and its scope-move markers; 0 when nothing has been compacted (no retention gap).
 */
const computeOldestRetainedSeq = async ({
  model,
  scopeFilter,
  streamKey,
}: {
  model: any;
  scopeFilter: Record<string, unknown>;
  streamKey: string;
}): Promise<number> => {
  // `deleted` stays top-level so tombstones (retained rows too) are counted in the floor
  // rather than hidden by isDeletedPlugin's injected exclusion.
  const lowestDoc = await model
    .findOne({$and: [scopeFilter, {_syncSeq: {$gt: 0}}], deleted: {$in: [true, false]}})
    .sort({_syncSeq: 1})
    .select({_syncSeq: 1})
    .lean();
  const lowestMarker = await SyncScopeMove.findOne({fromStream: streamKey})
    .sort({seq: 1})
    .select({seq: 1})
    .lean();
  const candidates: number[] = [];
  if (lowestDoc && typeof (lowestDoc as {_syncSeq?: number})._syncSeq === "number") {
    candidates.push((lowestDoc as {_syncSeq: number})._syncSeq);
  }
  if (lowestMarker && typeof (lowestMarker as {seq?: number}).seq === "number") {
    candidates.push((lowestMarker as {seq: number}).seq);
  }
  // No retained rows → no retention floor to enforce.
  return candidates.length > 0 ? Math.min(...candidates) : 0;
};

/**
 * C1: true when the stream's head (highest claimed seq) exceeds the stable frontier —
 * i.e. committed seqs are still coming once the in-flight writes below the frontier land.
 */
const frontierBelowStreamHead = async (
  streamKey: string,
  frontierSeq: number
): Promise<boolean> => {
  const counter = await SyncCounter.findOne({stream: streamKey}).select({seq: 1}).lean();
  const head = counter ? ((counter as {seq?: number}).seq ?? 0) : 0;
  return head > frontierSeq;
};

/**
 * Mount the SyncDB HTTP routes:
 * - GET /sync/streams — the authoritative set of streams the caller belongs to (C2)
 * - GET /sync/snapshot — per-stream bootstrap/catch-up with server-enforced scoping
 * - POST /sync/mutate — HTTP fallback mutation channel over applySyncMutation
 * - GET /sync/key — per-user key material for the default encryption KeyProvider
 */
export const addSyncRoutes = (app: express.Application, options: SyncAppOptions = {}): void => {
  const router = express.Router();

  // C2: authoritative membership discovery. Runs against the full req.user (D2) so
  // tenant memberships resolve from current organizationIds.
  router.get(
    "/sync/streams",
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      const user = req.user as User | undefined;
      if (!user) {
        throw new APIError({status: 401, title: "Authentication required"});
      }
      const streams: SyncStreamInfo[] = [];
      for (const entry of getSyncRegistry()) {
        if (!(await checkPermissions("list", entry.options.permissions.list, user))) {
          continue;
        }
        try {
          const entryStreams = await resolveUserStreamsForEntry({
            entry,
            getUserScopes: options.getUserScopes,
            user,
          });
          for (const stream of entryStreams) {
            streams.push({collection: entry.collectionTag, stream});
          }
        } catch (error: unknown) {
          throw new APIError({
            status: 500,
            title: `Failed to resolve streams for ${entry.collectionTag}: ${String(error)}`,
          });
        }
      }
      const response: SyncStreamsResponse = {streams};
      return res.json(response);
    })
  );

  router.get(
    "/sync/snapshot",
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      const user = req.user as User | undefined;
      if (!user) {
        throw new APIError({status: 401, title: "Authentication required"});
      }
      const streamKey = String(req.query.stream ?? "");
      if (!streamKey) {
        throw new APIError({status: 400, title: "stream query parameter is required"});
      }
      const parsed = parseStreamKey(streamKey);
      if (!parsed) {
        throw new APIError({status: 400, title: `Invalid stream key: ${streamKey}`});
      }
      const entry = findSyncEntryByCollectionTag(parsed.collectionTag);
      if (!entry) {
        throw new APIError({
          status: 404,
          title: `Unknown sync collection: ${parsed.collectionTag}`,
        });
      }
      if (!(await checkPermissions("list", entry.options.permissions.list, user))) {
        throw new APIError({
          status: 403,
          title: `Access to sync snapshot for ${parsed.collectionTag} denied for ${user.id}`,
        });
      }
      // C2: a client must not snapshot a stream it does not belong to.
      const memberStreams = await resolveUserStreamsForEntry({
        entry,
        getUserScopes: options.getUserScopes,
        user,
      });
      if (!memberStreams.includes(streamKey)) {
        throw new APIError({
          status: 403,
          title: `User ${user.id} does not belong to stream ${streamKey}`,
        });
      }

      const cursor = parseNonNegativeInt(req.query.cursor, "cursor", 0);
      const requestedLimit = parseNonNegativeInt(
        req.query.limit,
        "limit",
        options.defaultSnapshotLimit ?? DEFAULT_SNAPSHOT_LIMIT
      );
      const limit = Math.min(Math.max(requestedLimit, 1), MAX_SNAPSHOT_LIMIT);
      const legacyCursorIn =
        typeof req.query.legacyCursor === "string" && req.query.legacyCursor.length > 0
          ? req.query.legacyCursor
          : undefined;

      const snapshotFilterResult = entry.config.snapshotFilter
        ? await entry.config.snapshotFilter({id: String(user.id)})
        : undefined;
      const scopeFilter = buildSnapshotScopeFilter({
        entry,
        scopeValue: parsed.scopeValue,
        snapshotFilterResult,
      });
      const model = mongoose.model(entry.modelName);
      const frontierSeq = await computeStableFrontier({stream: streamKey});
      const oldestRetainedSeq = await computeOldestRetainedSeq({model, scopeFilter, streamKey});

      // C3: legacy (seq-0) stratum, paged by _id. Drained fully before seq paging begins.
      if (cursor === 0) {
        const legacyResult = await pageLegacyStratum({
          entry,
          legacyCursorIn,
          limit,
          model,
          req,
          scopeFilter,
        });
        if (legacyResult) {
          const response: SyncSnapshotResponse = {
            cursor: 0,
            entities: legacyResult.entities,
            frontierSeq,
            hasMore: true,
            legacyCursor: legacyResult.legacyCursor,
            oldestRetainedSeq,
            stream: streamKey,
          };
          return res.json(response);
        }
      }

      // C1: never page past the stable frontier — a cursor must not cross an uncommitted hole.
      const seqFilter = {_syncSeq: {$gt: cursor, $lte: frontierSeq}};
      // M1: compose the scope + seq clauses with $and (never spread-merge, which lets a
      // scopeFilter $or clobber the seq clause). `deleted` MUST stay a TOP-LEVEL key:
      // isDeletedPlugin injects {deleted: {$ne: true}} only when the top-level filter has
      // no `deleted` key — burying it inside $and would let the plugin re-inject its
      // exclusion and hide the tombstones catch-up depends on.
      const query = {$and: [scopeFilter, seqFilter], deleted: {$in: [true, false]}};
      const docs = await model
        .find(query)
        .sort({_syncSeq: 1})
        .limit(limit + 1);

      // C4: merge SyncScopeMove markers for THIS (old) stream into the page as tombstones,
      // so an offline old-stream client learns the doc left its stream.
      const markers = await SyncScopeMove.find({
        fromStream: streamKey,
        seq: {$gt: cursor, $lte: frontierSeq},
      })
        .sort({seq: 1})
        .limit(limit + 1)
        .lean();

      const page = docs.slice(0, limit);
      // C6 (M2): run the same per-doc read permission the delta path uses; drop denied
      // docs but still advance the cursor past them (parity with delta behavior).
      const docEntities: SyncEntityPayload[] = [];
      for (const doc of page as any[]) {
        const allowed = await checkPermissions("read", entry.options.permissions.read, user, doc);
        if (!allowed) {
          continue;
        }
        const isTombstone = Boolean(doc.deleted);
        docEntities.push({
          // C7: tombstones carry no data (privacy + payload growth) — only id/seq/deleted.
          data: isTombstone ? null : await serializeSyncDoc({doc, entry, req}),
          deleted: isTombstone,
          id: String(doc._id),
          seq: doc._syncSeq ?? 0,
        });
      }
      const markerEntities: SyncEntityPayload[] = markers.map(
        (m: SyncScopeMoveDocument): SyncEntityPayload => ({
          data: null,
          deleted: true,
          id: m.entityId,
          seq: m.seq,
        })
      );
      // Union doc page + marker tombstones, sort by seq, page by frontier/limit.
      const merged = [...docEntities, ...markerEntities].sort((a, b) => a.seq - b.seq);
      const entities = merged.slice(0, limit);

      // hasMore when: a full doc page was returned, extra markers remain, or the frontier
      // sits below the head (more committed seqs are coming once in-flight writes land).
      const docsHaveMore = docs.length > limit;
      const markersHaveMore = markers.length > limit || merged.length > entities.length;
      const frontierBelowHead = await frontierBelowStreamHead(streamKey, frontierSeq);
      const hasMore = docsHaveMore || markersHaveMore || frontierBelowHead;

      // C1: never advance the client past an uncommitted hole — clamp the returned cursor
      // to the frontier (and to the highest entity seq actually included).
      const lastEntitySeq = entities.length > 0 ? entities[entities.length - 1].seq : cursor;
      const nextCursor = Math.min(Math.max(lastEntitySeq, cursor), frontierSeq);
      const response: SyncSnapshotResponse = {
        cursor: nextCursor,
        entities,
        frontierSeq,
        hasMore,
        oldestRetainedSeq,
        stream: streamKey,
      };
      return res.json(response);
    })
  );

  router.post(
    "/sync/mutate",
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      const user = req.user as User | undefined;
      if (!user) {
        throw new APIError({status: 401, title: "Authentication required"});
      }
      const userId = String(user.id);
      if (wouldExceedHttpMutationRateLimit(userId, 1)) {
        return res.status(NACK_HTTP_STATUS.rate_limited).json({
          nack: {
            code: "rate_limited",
            message: `Rate limit of ${MAX_SYNC_HTTP_MUTATIONS_PER_SECOND} mutations per second exceeded`,
            mutationId: String((req.body as SyncMutateRequest | undefined)?.mutationId ?? ""),
            retryAfterMs: httpMutationRateLimitRetryAfterMs(userId),
          },
        });
      }
      consumeHttpMutationRateLimit(userId, 1);
      const outcome = await applySyncMutation({
        mutation: req.body as SyncMutateRequest,
        req,
        scopeResolver: options.getUserScopes,
        user,
      });
      if (outcome.type === "ack") {
        return res.json({ack: outcome.ack});
      }
      // Duplicate deliveries reading a recorded outcome map to the same statuses.
      return res.status(NACK_HTTP_STATUS[outcome.nack.code]).json({nack: outcome.nack});
    })
  );

  router.post(
    "/sync/mutate/batch",
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      const user = req.user as User | undefined;
      if (!user) {
        throw new APIError({status: 401, title: "Authentication required"});
      }
      const body = req.body as SyncMutateBatchRequest | undefined;
      const mutations = Array.isArray(body?.mutations) ? body.mutations : [];

      // Batch size cap enforced BEFORE anything else (including rate limiting) —
      // an oversized batch is a client bug, rejected loudly with no side effects.
      if (mutations.length > MAX_SYNC_MUTATIONS_PER_BATCH) {
        const validation = validateSyncMutationBatch(mutations);
        if (!validation.ok) {
          return res.status(422).json(validation.response);
        }
      }

      const userId = String(user.id);
      // The socket path's rate limiter counts each mutation in the batch (not
      // each batch) against the window; mirror that here.
      if (wouldExceedHttpMutationRateLimit(userId, mutations.length)) {
        return res.status(NACK_HTTP_STATUS.rate_limited).json({
          results: [
            {
              nack: {
                code: "rate_limited",
                message: `Rate limit of ${MAX_SYNC_HTTP_MUTATIONS_PER_SECOND} mutations per second exceeded`,
                mutationId: "",
                retryAfterMs: httpMutationRateLimitRetryAfterMs(userId),
              },
              type: "nack",
            },
          ],
        });
      }
      consumeHttpMutationRateLimit(userId, mutations.length);

      const validation = validateSyncMutationBatch(mutations);
      if (!validation.ok) {
        return res.status(422).json(validation.response);
      }

      const response = await applySyncMutationBatch({
        mutations,
        req,
        scopeResolver: options.getUserScopes,
        user,
      });
      return res.json(response);
    })
  );

  router.get(
    "/sync/key",
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      const user = req.user as User | undefined;
      if (!user) {
        throw new APIError({status: 401, title: "Authentication required"});
      }
      const keyMaterial = await getOrCreateSyncKeyMaterial({userId: String(user.id)});
      return res.json({keyMaterial});
    })
  );

  router.use(apiErrorMiddleware);
  app.use(router);
};
