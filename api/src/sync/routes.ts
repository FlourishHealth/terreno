// biome-ignore-all lint/suspicious/noExplicitAny: sync routes operate generically across registered models
import express from "express";
import mongoose from "mongoose";
import {asyncHandler} from "../api";
import {authenticateMiddleware, type User} from "../auth";
import {APIError, apiErrorMiddleware} from "../errors";
import {checkPermissions} from "../permissions";
import {getOrCreateSyncKeyMaterial} from "./models";
import {applySyncMutation} from "./mutationHandler";
import {findSyncEntryByCollectionTag, type SyncRegistryEntry} from "./registry";
import {serializeSyncPayload} from "./serialize";
import {getScopeField} from "./streams";
import type {
  SyncEntityPayload,
  SyncMutateRequest,
  SyncNackCode,
  SyncSnapshotResponse,
} from "./types";

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

/** Build the server-enforced scope filter for a snapshot request. */
export const buildSnapshotScopeFilter = async ({
  entry,
  user,
  options,
}: {
  entry: SyncRegistryEntry;
  user: User;
  options: SyncAppOptions;
}): Promise<Record<string, unknown>> => {
  const {scope, snapshotFilter} = entry.config;
  if (snapshotFilter) {
    return snapshotFilter({id: String(user.id)});
  }
  if (typeof scope === "function") {
    // Unreachable for registered models (validated at registration), kept as a guard.
    throw new APIError({
      status: 500,
      title: `Sync collection ${entry.collectionTag} has a custom scope without a snapshotFilter`,
    });
  }
  if (scope.type === "broadcast") {
    return {};
  }
  const field = getScopeField(scope) as string;
  if (scope.type === "owner") {
    return {[field]: user.id};
  }
  // Tenant scope: restrict to the user's tenant memberships.
  if (!options.getUserScopes) {
    throw new APIError({
      status: 500,
      title:
        `Sync collection ${entry.collectionTag} is tenant-scoped but SyncApp has no ` +
        "getUserScopes resolver",
    });
  }
  const scopes = await options.getUserScopes(user, entry);
  return {[field]: {$in: scopes}};
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
 * Mount the SyncDB HTTP routes:
 * - GET /sync/snapshot — bootstrap/catch-up per collection with server-enforced scoping
 * - POST /sync/mutate — HTTP fallback mutation channel over applySyncMutation
 * - GET /sync/key — per-user key material for the default encryption KeyProvider
 */
export const addSyncRoutes = (app: express.Application, options: SyncAppOptions = {}): void => {
  const router = express.Router();
  router.get(
    "/sync/snapshot",
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      const user = req.user as User | undefined;
      if (!user) {
        throw new APIError({status: 401, title: "Authentication required"});
      }
      const collection = String(req.query.collection ?? "");
      if (!collection) {
        throw new APIError({status: 400, title: "collection query parameter is required"});
      }
      const entry = findSyncEntryByCollectionTag(collection);
      if (!entry) {
        throw new APIError({status: 404, title: `Unknown sync collection: ${collection}`});
      }
      if (!(await checkPermissions("list", entry.options.permissions.list, user))) {
        throw new APIError({
          status: 403,
          title: `Access to sync snapshot for ${collection} denied for ${user.id}`,
        });
      }

      const cursor = parseNonNegativeInt(req.query.cursor, "cursor", 0);
      const requestedLimit = parseNonNegativeInt(
        req.query.limit,
        "limit",
        options.defaultSnapshotLimit ?? DEFAULT_SNAPSHOT_LIMIT
      );
      const limit = Math.min(Math.max(requestedLimit, 1), MAX_SNAPSHOT_LIMIT);

      const scopeFilter = await buildSnapshotScopeFilter({entry, options, user});
      const model = mongoose.model(entry.modelName);
      // deleted must be explicitly matched: isDeletedPlugin auto-injects
      // {deleted: {$ne: true}} into find() and would silently hide the tombstones
      // that catch-up depends on. Legacy docs without a _syncSeq are included in the
      // first page (cursor=0) and report seq 0.
      const seqFilter =
        cursor === 0
          ? {$or: [{_syncSeq: {$gt: 0}}, {_syncSeq: {$exists: false}}]}
          : {_syncSeq: {$gt: cursor}};
      const docs = await model
        .find({...scopeFilter, deleted: {$in: [true, false]}, ...seqFilter})
        .sort({_syncSeq: 1})
        .limit(limit + 1);

      const page = docs.slice(0, limit);
      const entities: SyncEntityPayload[] = await Promise.all(
        page.map(
          async (doc: any): Promise<SyncEntityPayload> => ({
            data: await serializeSyncDoc({doc, entry, req}),
            deleted: Boolean(doc.deleted),
            id: String(doc._id),
            seq: doc._syncSeq ?? 0,
          })
        )
      );
      const response: SyncSnapshotResponse = {
        cursor: entities.length > 0 ? entities[entities.length - 1].seq : cursor,
        entities,
        hasMore: docs.length > limit,
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
      const outcome = await applySyncMutation({
        mutation: req.body as SyncMutateRequest,
        req,
        user,
      });
      if (outcome.type === "ack") {
        return res.json({ack: outcome.ack});
      }
      // Duplicate deliveries reading a recorded outcome map to the same statuses.
      return res.status(NACK_HTTP_STATUS[outcome.nack.code]).json({nack: outcome.nack});
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
