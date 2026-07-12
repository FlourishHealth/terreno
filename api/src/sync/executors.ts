/**
 * Transport-agnostic CRUD executors extracted from modelRouter's Express handlers.
 *
 * These run the full write pipeline — method-level and object-level permission checks,
 * the deprecated `transformer.transform`, pre/post hooks, Mongoose validation, population,
 * and soft-delete semantics — without requiring an HTTP request/response. The REST handlers
 * in `api.ts` are thin wrappers over these, and the sync mutation channel
 * (`applySyncMutation`) calls them directly.
 *
 * Hook compatibility: ModelRouterOptions hooks receive an `express.Request`. When an
 * executor is called without `req` (e.g. from the sync channel), a minimal stub object
 * `{user}` is passed instead, cast to `express.Request`. Hooks that only read `req.user`
 * keep working; hooks that read other request properties (headers, params, body) will see
 * `undefined` for those. REST handlers always pass the real request through, so existing
 * behavior over HTTP is unchanged.
 */
import type express from "express";
import cloneDeep from "lodash/cloneDeep";
import {DateTime} from "luxon";
import type {Document, Model} from "mongoose";

import {addPopulateToQuery, type ModelRouterOptions} from "../api";
import type {User} from "../auth";
import {loadDocOr404} from "../docLoader";
import {
  APIError,
  type APIErrorConstructor,
  errorMessage,
  getDisableExternalErrorTracking,
  isAPIError,
} from "../errors";
import {checkPermissions} from "../permissions";
import {transform} from "../transformers";

/** A hydrated mongoose document joined with the router's base type. */
export type ExecutorDoc<T> = Document<unknown, unknown, unknown> & T;

/** Result of a successful executor run. */
export interface ExecutorResult<T> {
  /**
   * The document after the operation completed: the created doc, the saved update, or the
   * deleted doc (tombstoned with `deleted: true` for soft-delete models). Populated per
   * `options.populatePaths` for create/update, matching the REST handlers.
   */
  doc: ExecutorDoc<T>;
  /**
   * C5 (FIX 6): present only when `executeUpdate` was called with
   * `skipPostHooks: true` — the cleaned/transformed update body, needed to
   * run `postUpdate` later via `runPostUpdate`.
   */
  cleanedBody?: Partial<T>;
  /**
   * C5 (FIX 6): present only when `executeUpdate` was called with
   * `skipPostHooks: true` — the pre-update document snapshot, needed to
   * run `postUpdate` later via `runPostUpdate`.
   */
  prevDoc?: T;
}

/**
 * Optimistic-concurrency check for executeUpdate.
 *
 * - `timestamp`: replicates the REST `If-Unmodified-Since` last-write-wins check. The update
 *   is rejected with an `ExecutorConflictError` (409) when `ifUnmodifiedSince` is older than
 *   the document's `updated` (falling back to `created`) timestamp. An invalid Date throws a
 *   400 "Invalid conflict-detection timestamp" carrying `invalidTimestampDetail` so REST
 *   handlers can report which header/body field failed to parse.
 * - `seq`: compares `baseSeq` against the document's `_syncSeq`; any mismatch throws an
 *   `ExecutorConflictError` (409) carrying the current server doc and seq.
 *
 * The check runs after `preUpdate` (same as the REST handler) so unauthorized mutations are
 * rejected before document data can leak in a conflict response.
 */
export type ExecutorConcurrencyCheck =
  | {
      type: "timestamp";
      /** Reject the update if the doc was modified after this instant. */
      ifUnmodifiedSince: Date;
      /** Detail for the 400 error when `ifUnmodifiedSince` is an invalid Date. */
      invalidTimestampDetail?: string;
    }
  | {
      type: "seq";
      /** The `_syncSeq` the client last saw; must match the doc's current `_syncSeq`. */
      baseSeq: number;
    };

interface ExecutorConflictErrorConstructor extends APIErrorConstructor {
  conflictType: "timestamp" | "seq";
  doc: unknown;
  serverSeq?: number;
}

/**
 * Thrown by executeUpdate when a concurrency check fails. Carries the current server document
 * (canonical copy) so callers can serialize it into a conflict response: the REST handler
 * turns timestamp conflicts into the legacy 409 `{data, error, message}` body, and the sync
 * mutation channel returns the doc + seq in its conflict nack.
 */
export class ExecutorConflictError extends APIError {
  /** Which concurrency mode detected the conflict. */
  conflictType: "timestamp" | "seq";

  /** The current server document at conflict time. */
  doc: unknown;

  /** The doc's `_syncSeq` at conflict time (seq mode only). */
  serverSeq?: number;

  constructor({conflictType, doc, serverSeq, ...apiErrorData}: ExecutorConflictErrorConstructor) {
    super(apiErrorData);
    this.conflictType = conflictType;
    this.doc = doc;
    this.serverSeq = serverSeq;
  }
}

/**
 * Duck-typed guard for {@link ExecutorConflictError}. The package compiles to ES5, where
 * TypeScript's emit for classes extending built-ins (Error) breaks the prototype chain, so
 * `instanceof` returns false for consumers running the compiled dist (bun running the TS
 * source directly is unaffected — which is why unit/integration tests never caught it).
 * Always use this guard instead of `instanceof ExecutorConflictError`.
 */
export const isExecutorConflictError = (error: unknown): error is ExecutorConflictError => {
  if (error instanceof ExecutorConflictError) {
    return true;
  }
  const candidate = error as {conflictType?: unknown; status?: unknown; doc?: unknown};
  return (
    !!candidate &&
    typeof candidate === "object" &&
    (candidate.conflictType === "timestamp" || candidate.conflictType === "seq") &&
    candidate.status === 409
  );
};

/**
 * Minimal stand-in for an Express request when executors run outside HTTP. Only `user` is
 * populated — see the module doc comment for the hook compatibility contract.
 */
const stubRequest = (user?: User): express.Request => ({user}) as unknown as express.Request;

/**
 * Create a document through the same pipeline as `POST /`: method-level permissions,
 * `transformer.transform`, `preCreate`, `Model.create` (Mongoose validation), population,
 * and `postCreate`. Throws APIErrors with the same statuses/titles as the REST handler.
 */
export const executeCreate = async <T>({
  model,
  options,
  user,
  body,
  req,
  skipPostHooks,
}: {
  model: Model<T>;
  options: ModelRouterOptions<T>;
  user?: User;
  body: unknown;
  /** The real Express request when called over HTTP; hooks receive a `{user}` stub otherwise. */
  req?: express.Request;
  /**
   * C5 (FIX 6): when true, skip the built-in `postCreate` call — the caller
   * (the sync mutation handler) runs it manually AFTER finalizing the
   * idempotency ledger `applied`, so a post-hook throw can never make a
   * committed write look like a failure. REST handlers never set this.
   */
  skipPostHooks?: boolean;
}): Promise<ExecutorResult<T>> => {
  const request = req ?? stubRequest(user);

  if (!(await checkPermissions("create", options.permissions.create, user))) {
    throw new APIError({
      status: 405,
      title: `Access to CREATE on ${model.modelName} denied for ${user?.id}`,
    });
  }

  let cleanedBody: Partial<T> | (Partial<T> | undefined)[] | null | undefined;
  try {
    cleanedBody = transform<T>(options, body as Partial<T> | Partial<T>[], "create", user);
  } catch (error: unknown) {
    if (isAPIError(error)) {
      throw error;
    }
    throw new APIError({
      disableExternalErrorTracking: getDisableExternalErrorTracking(error),
      error,
      status: 400,
      title: errorMessage(error),
    });
  }
  if (options.preCreate) {
    try {
      cleanedBody = await options.preCreate(cleanedBody, request);
    } catch (error: unknown) {
      if (isAPIError(error)) {
        throw error;
      }
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 400,
        title: `preCreate hook error: ${errorMessage(error)}`,
      });
    }
    if (cleanedBody === undefined) {
      throw new APIError({
        detail: "A body must be returned from preCreate",
        status: 403,
        title: "Create not allowed",
      });
    }
    if (cleanedBody === null) {
      throw new APIError({
        detail: "preCreate hook returned null",
        status: 403,
        title: "Create not allowed",
      });
    }
  }
  if (cleanedBody === undefined) {
    throw new APIError({
      detail: "Body is undefined",
      status: 400,
      title: "Invalid request body",
    });
  }
  let data: ExecutorDoc<T>;
  try {
    data = (await model.create(cleanedBody as T)) as ExecutorDoc<T>;
  } catch (error: unknown) {
    throw new APIError({
      disableExternalErrorTracking: getDisableExternalErrorTracking(error),
      error,
      status: 400,
      title: errorMessage(error),
    });
  }

  if (options.populatePaths) {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: mongoose Query type varies based on populatePaths
      let populateQuery: any = model.findById(data._id);
      populateQuery = addPopulateToQuery(populateQuery, options.populatePaths);
      data = await populateQuery.exec();
    } catch (error: unknown) {
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 400,
        title: `Populate error: ${errorMessage(error)}`,
      });
    }
  }

  if (options.postCreate && !skipPostHooks) {
    try {
      await options.postCreate(data, request);
    } catch (error: unknown) {
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 400,
        title: `postCreate hook error: ${errorMessage(error)}`,
      });
    }
  }
  return {doc: data};
};

/**
 * C5 (FIX 6): run `postCreate` outside the write transaction/ledger-finalize
 * window. Errors are the caller's responsibility to catch — the sync mutation
 * handler logs them and reports a warning, never converting them into a nack
 * (the document write already committed and the ledger already finalized
 * `applied`).
 */
export const runPostCreate = async <T>({
  doc,
  options,
  request,
}: {
  doc: ExecutorDoc<T>;
  options: ModelRouterOptions<T>;
  request: express.Request;
}): Promise<void> => {
  if (options.postCreate) {
    await options.postCreate(doc, request);
  }
};

/**
 * Update a document through the same pipeline as `PATCH /:id`: method-level and object-level
 * permissions, doc loading (404), `transformer.transform`, `_updatedAt` stripping,
 * `preUpdate`, the optional concurrency check, `doc.set` + `doc.save` (Mongoose validation),
 * population, and `postUpdate`. Throws APIErrors with the same statuses/titles as the REST
 * handler; concurrency conflicts throw `ExecutorConflictError` (409) carrying the server doc.
 */
export const executeUpdate = async <T>({
  model,
  options,
  user,
  id,
  body,
  concurrencyCheck,
  existingDoc,
  req,
  skipPostHooks,
}: {
  model: Model<T>;
  options: ModelRouterOptions<T>;
  user?: User;
  id: string;
  body: unknown;
  concurrencyCheck?: ExecutorConcurrencyCheck;
  /**
   * Pre-loaded document, used by the REST handler where permissionMiddleware already loaded
   * and authorized it (avoids a second fetch). Permission checks still run either way.
   */
  existingDoc?: ExecutorDoc<T>;
  /** The real Express request when called over HTTP; hooks receive a `{user}` stub otherwise. */
  req?: express.Request;
  /** C5 (FIX 6): see `executeCreate`'s `skipPostHooks` doc comment. */
  skipPostHooks?: boolean;
}): Promise<ExecutorResult<T>> => {
  const request = req ?? stubRequest(user);

  if (!(await checkPermissions("update", options.permissions.update, user))) {
    throw new APIError({
      status: 405,
      title: `Access to UPDATE on ${model.modelName} denied for ${user?.id}`,
    });
  }

  let doc =
    existingDoc ?? ((await loadDocOr404<T>(model, id, options.populatePaths)) as ExecutorDoc<T>);

  if (!(await checkPermissions("update", options.permissions.update, user, doc))) {
    throw new APIError({
      status: 403,
      title: `Access to GET on ${model.modelName}:${id} denied for ${user?.id}`,
    });
  }

  let cleanedBody: Partial<T> | T | null | undefined;
  try {
    cleanedBody = transform<T>(options, body as Partial<T>, "update", user) as Partial<T>;
  } catch (error: unknown) {
    if (isAPIError(error)) {
      throw error;
    }
    throw new APIError({
      disableExternalErrorTracking: getDisableExternalErrorTracking(error),
      error,
      status: 403,
      title: `PATCH failed on ${id} for user ${user?.id}: ${errorMessage(error)}`,
    });
  }

  // `_updatedAt` is conflict-detection metadata, not a model field: strip it from both the
  // raw and transformed bodies before preUpdate processes them (mirrors the REST handler).
  if (body && typeof body === "object") {
    delete (body as Record<string, unknown>)._updatedAt;
  }
  if (cleanedBody && typeof cleanedBody === "object") {
    delete (cleanedBody as Record<string, unknown>)._updatedAt;
  }

  if (options.preUpdate) {
    try {
      cleanedBody = await options.preUpdate(cleanedBody as Partial<T>, request);
    } catch (error: unknown) {
      if (isAPIError(error)) {
        throw error;
      }
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 400,
        title: `preUpdate hook error on ${id}: ${errorMessage(error)}`,
      });
    }
    if (cleanedBody === undefined) {
      throw new APIError({
        detail: "A body must be returned from preUpdate",
        status: 403,
        title: "Update not allowed",
      });
    }
    if (cleanedBody === null) {
      throw new APIError({
        detail: `preUpdate hook on ${id} returned null`,
        status: 403,
        title: "Update not allowed",
      });
    }
  }

  // Conflict detection runs after preUpdate so that unauthorized mutations
  // are rejected before we leak document data in a conflict response.
  if (concurrencyCheck?.type === "timestamp") {
    const clientTimestamp = DateTime.fromJSDate(concurrencyCheck.ifUnmodifiedSince);
    if (!clientTimestamp.isValid) {
      throw new APIError({
        detail:
          concurrencyCheck.invalidTimestampDetail ??
          "Conflict-detection timestamp could not be parsed as a date",
        status: 400,
        title: "Invalid conflict-detection timestamp",
      });
    }

    const docRecord = doc as {created?: Date | string; updated?: Date | string};
    let serverTimestamp: DateTime | null = null;
    const serverTimestampValue = docRecord.updated ?? docRecord.created;
    if (serverTimestampValue instanceof Date) {
      serverTimestamp = DateTime.fromJSDate(serverTimestampValue);
    } else if (typeof serverTimestampValue === "string") {
      serverTimestamp = DateTime.fromISO(serverTimestampValue);
    }

    if (serverTimestamp && !serverTimestamp.isValid) {
      throw new APIError({
        detail: "Document timestamp could not be parsed as a date",
        status: 400,
        title: "Invalid server timestamp",
      });
    }

    if (serverTimestamp && clientTimestamp < serverTimestamp) {
      throw new ExecutorConflictError({
        conflictType: "timestamp",
        detail: "Document was modified since your last read",
        disableExternalErrorTracking: true,
        doc,
        status: 409,
        title: "Conflict",
      });
    }
  } else if (concurrencyCheck?.type === "seq") {
    const serverSeq = (doc as {_syncSeq?: number})._syncSeq ?? 0;
    if (concurrencyCheck.baseSeq !== serverSeq) {
      throw new ExecutorConflictError({
        conflictType: "seq",
        detail: "Document was modified since your last read",
        disableExternalErrorTracking: true,
        doc,
        serverSeq,
        status: 409,
        title: `Sync conflict on ${model.modelName}:${id}: baseSeq ${concurrencyCheck.baseSeq} does not match server seq ${serverSeq}`,
      });
    }
  }

  // Make a copy for passing pre-saved values to hooks.
  const prevDoc = cloneDeep(doc);

  // Using .save here runs the risk of a versioning error if you try to make two simultaneous
  // updates. We won't wind up with corrupted data, just an API error.
  try {
    doc.set(cleanedBody);
    await doc.save();
  } catch (error: unknown) {
    throw new APIError({
      disableExternalErrorTracking: getDisableExternalErrorTracking(error),
      error,
      status: 400,
      title: `preUpdate hook save error on ${id}: ${errorMessage(error)}`,
    });
  }

  if (options.populatePaths) {
    // biome-ignore lint/suspicious/noExplicitAny: mongoose Query type varies based on populatePaths
    let populateQuery: any = model.findById(doc._id);
    populateQuery = addPopulateToQuery(populateQuery, options.populatePaths);
    doc = await populateQuery.exec();
  }

  if (options.postUpdate && !skipPostHooks) {
    try {
      await options.postUpdate(doc, cleanedBody as Partial<T>, request, prevDoc as T);
    } catch (error: unknown) {
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 400,
        title: `postUpdate hook error on ${id}: ${errorMessage(error)}`,
      });
    }
  }

  return {cleanedBody: cleanedBody as Partial<T>, doc, prevDoc: prevDoc as T};
};

/** C5 (FIX 6): run `postUpdate` outside the write/ledger-finalize window — see `runPostCreate`. */
export const runPostUpdate = async <T>({
  doc,
  cleanedBody,
  prevDoc,
  options,
  request,
}: {
  doc: ExecutorDoc<T>;
  cleanedBody: Partial<T>;
  prevDoc: T;
  options: ModelRouterOptions<T>;
  request: express.Request;
}): Promise<void> => {
  if (options.postUpdate) {
    await options.postUpdate(doc, cleanedBody, request, prevDoc);
  }
};

/**
 * Delete a document through the same pipeline as `DELETE /:id`: method-level and object-level
 * permissions, doc loading (404), `preDelete`, soft delete (`deleted = true` + save when the
 * schema has a Boolean `deleted` path, else `doc.deleteOne()`), and `postDelete`. Throws
 * APIErrors with the same statuses/titles as the REST handler.
 */
export const executeDelete = async <T>({
  model,
  options,
  user,
  id,
  existingDoc,
  req,
  skipPostHooks,
}: {
  model: Model<T>;
  options: ModelRouterOptions<T>;
  user?: User;
  id: string;
  /**
   * Pre-loaded document, used by the REST handler where permissionMiddleware already loaded
   * and authorized it (avoids a second fetch). Permission checks still run either way.
   */
  existingDoc?: ExecutorDoc<T> & {deleted?: boolean};
  /** The real Express request when called over HTTP; hooks receive a `{user}` stub otherwise. */
  req?: express.Request;
  /** C5 (FIX 6): see `executeCreate`'s `skipPostHooks` doc comment. */
  skipPostHooks?: boolean;
}): Promise<ExecutorResult<T>> => {
  const request = req ?? stubRequest(user);

  if (!(await checkPermissions("delete", options.permissions.delete, user))) {
    throw new APIError({
      status: 405,
      title: `Access to DELETE on ${model.modelName} denied for ${user?.id}`,
    });
  }

  const doc =
    existingDoc ??
    ((await loadDocOr404<T>(model, id, options.populatePaths)) as ExecutorDoc<T> & {
      deleted?: boolean;
    });

  if (!(await checkPermissions("delete", options.permissions.delete, user, doc))) {
    throw new APIError({
      status: 403,
      title: `Access to GET on ${model.modelName}:${id} denied for ${user?.id}`,
    });
  }

  if (options.preDelete) {
    let body: T | null | undefined;
    try {
      body = await options.preDelete(doc, request);
    } catch (error: unknown) {
      if (isAPIError(error)) {
        throw error;
      }
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 403,
        title: `preDelete hook error on ${id}: ${errorMessage(error)}`,
      });
    }
    if (body === undefined) {
      throw new APIError({
        detail: "A body must be returned from preDelete",
        status: 403,
        title: "Delete not allowed",
      });
    }
    if (body === null) {
      throw new APIError({
        detail: `preDelete hook for ${id} returned null`,
        status: 403,
        title: "Delete not allowed",
      });
    }
  }

  // Support .deleted from isDeleted plugin
  if (
    Object.keys(model.schema.paths).includes("deleted") &&
    model.schema.paths.deleted.instance === "Boolean"
  ) {
    doc.deleted = true;
    await doc.save();
  } else {
    // For models without the isDeleted plugin
    try {
      await doc.deleteOne();
    } catch (error: unknown) {
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 400,
        title: errorMessage(error),
      });
    }
  }

  if (options.postDelete && !skipPostHooks) {
    try {
      await options.postDelete(request, doc);
    } catch (error: unknown) {
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 400,
        title: `postDelete hook error: ${errorMessage(error)}`,
      });
    }
  }

  return {doc};
};

/** C5 (FIX 6): run `postDelete` outside the write/ledger-finalize window — see `runPostCreate`. */
export const runPostDelete = async <T>({
  doc,
  options,
  request,
}: {
  doc: ExecutorDoc<T>;
  options: ModelRouterOptions<T>;
  request: express.Request;
}): Promise<void> => {
  if (options.postDelete) {
    await options.postDelete(request, doc);
  }
};
