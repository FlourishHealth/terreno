/**
 * This is the doc comment for api.ts
 *
 * @packageDocumentation
 */
import * as Sentry from "@sentry/bun";
import express, {type NextFunction, type Request, type Response} from "express";
import cloneDeep from "lodash/cloneDeep";
import {DateTime} from "luxon";
import mongoose, {type Document, type Model} from "mongoose";

import {
  assertNoActionCollisions,
  type CollectionActionConfig,
  type InstanceActionConfig,
  registerActionRoutes,
} from "./actions";
import {authenticateMiddleware, type User} from "./auth";
import {
  APIError,
  apiErrorMiddleware,
  errorMessage,
  errorStack,
  getDisableExternalErrorTracking,
  isAPIError,
} from "./errors";
import {logger} from "./logger";
import {
  createOpenApiMiddleware,
  deleteOpenApiMiddleware,
  getOpenApiMiddleware,
  listOpenApiMiddleware,
  patchOpenApiMiddleware,
} from "./openApi";
import {
  buildQuerySchemaFromFields,
  type ModelRouterValidationOptions,
  validateModelRequestBody,
  validateQueryParams,
} from "./openApiValidator";
import {checkPermissions, permissionMiddleware, type RESTPermissions} from "./permissions";
import type {PopulatePath} from "./populate";
import {registerRealtime} from "./realtime/registry";
import type {RealtimeConfig} from "./realtime/types";
import {registerSync} from "./sync/registry";
import type {SyncConfig} from "./sync/types";
import {
  defaultResponseHandler,
  serialize,
  type TerrenoTransformer,
  transform,
} from "./transformers";
import {isValidObjectId} from "./utils";

export type JSONPrimitive = string | number | boolean | null;
export interface JSONArray extends Array<JSONValue> {}
export interface JSONObject {
  [member: string]: JSONValue;
}
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export const addPopulateToQuery = (
  // biome-ignore lint/suspicious/noExplicitAny: mongoose Query type parameters vary widely across populated/unpopulated documents — caller passes concrete types
  builtQuery: mongoose.Query<any[], any, Record<string, never>, any>,
  populatePaths?: PopulatePath[]
) => {
  const paths = populatePaths ?? [];
  let query = builtQuery;

  for (const populatePath of paths) {
    const path = populatePath.path;
    const select = populatePath.fields;
    query = builtQuery.populate({path, select});
  }
  return query;
};

// TODOS:
// Support bulk actions
// Support more complex query fields
// Rate limiting

// These are the query params that are reserved for pagination.
const PAGINATION_QUERY_PARAMS = ["limit", "page", "sort"];

// Add support for more complex queries.
const COMPLEX_QUERY_PARAMS = ["$and", "$or"];

/**
 * @param a - the first number
 * @param b - the second number
 * @returns The sum of `a` and `b`
 */
export type RESTMethod = "list" | "create" | "read" | "update" | "delete";

/**
 * Interface for the vendored @wesleytodd/openapi Express middleware.
 * Provides methods for building OpenAPI documentation from Express routes.
 */
export interface OpenApiMiddleware {
  /** The middleware itself is callable as Express middleware. */
  (req: express.Request, res: express.Response, next: express.NextFunction): void;
  /** Register a path-level OpenAPI schema, returning an Express middleware that attaches the schema to the route. */
  path: (schema?: Record<string, unknown>) => express.RequestHandler;
  /** Register or retrieve an OpenAPI component definition (schemas, responses, parameters, etc). */
  component: (
    type: string,
    name?: string,
    description?: Record<string, unknown>
  ) => OpenApiMiddleware | {$ref: string} | Record<string, unknown> | undefined;
  /** Shorthand for component("schemas", ...) */
  schema: (
    name?: string,
    description?: Record<string, unknown>
  ) => OpenApiMiddleware | {$ref: string} | Record<string, unknown> | undefined;
  /** The generated OpenAPI document */
  document: Record<string, unknown>;
}

/**
 * This is the main configuration.
 * @param T - the base document type. This should not include Mongoose models, just the types of the object.
 */
export interface ModelRouterOptions<T> {
  /**
   * A group of method-level (create/read/update/delete/list) permissions.
   * Determine if the user can perform the operation at all, and for read/update/delete methods,
   * whether the user can perform the operation on the object referenced.
   * */
  permissions: RESTPermissions<T>;
  /**
   * Allow anonymous users to access the resource.
   * Defaults to false.
   */
  allowAnonymous?: boolean;
  /**
   * A list of fields on the model that can be queried using standard comparisons for booleans,
   * strings, dates
   *    (as ISOStrings), and numbers.
   * For example:
   *  ?foo=true // boolean query
   *  ?foo=bar // string query
   *  ?foo=1 // number query
   *  ?foo=2022-07-23T02:34:07.118Z // date query (should first be encoded for query params, not shown here)
   * Note: `limit` and `page` are automatically supported and are reserved. */
  queryFields?: string[];
  /**
   * queryFilter is a function to parse the query params and see if the query should be allowed.
   * This can be used for permissioning to make sure less privileged users are not making
   * privileged queries. If a query should not be allowed,
   * return `null` from the function and an empty query result will be returned to the client
   * without an error. You can also throw an APIError to be explicit about the issues.
   * You can transform the given query params by returning different values.
   * If the query is acceptable as-is, return `query` as-is.
   */
  queryFilter?: (
    user?: User,
    query?: Record<string, unknown>
  ) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
  /**
   * Transformers allow data to be transformed before actions are executed,
   * and serialized before being returned to the user.
   *
   * Transformers can be used to throw out fields that the user should not be able to write to, such as the `admin` flag.
   * Serializers can be used to hide data from the client or change how it is presented. Serializers run after the data
   * has been changed or queried but before returning to the client.
   * @deprecated Use preCreate/preUpdate/preDelete hooks instead of transformer.transform. Use serialize instead of
   * transformer.serialize.
   * */
  transformer?: TerrenoTransformer<T>;
  /** Default sort for list operations. Can be a single field, a space-seperated list of fields, or an object.
   * ?sort=foo // single field: foo ascending
   * ?sort=-foo // single field: foo descending
   * ?sort=-foo bar // multi field: foo descending, bar ascending
   * ?sort=\{foo: 'ascending', bar: 'descending'\} // object: foo ascending, bar descending
   *
   * Note: you should have an index field on these fields or Mongo may slow down considerably.
   * */
  sort?: string | {[key: string]: "ascending" | "descending"};
  /**
   * Default queries to provide to Mongo before any user queries or transforms happen when making
   * list queries. Accepts any Mongoose-style queries, and runs for all user types.
   *    defaultQueryParams: \{hidden: false\} // By default, don't show objects with hidden=true
   * These can be overridden by the user if not disallowed by queryFilter. */
  defaultQueryParams?: Record<string, unknown>;
  /**
   * Manages Mongoose populations before returning from all methods (list, read, create, etc).
   * For each population:
   *  path: Accepts Mongoose-style populate strings for path. e.g. "user" or "users.userId"
   *    (for an array of subschemas with userId)
   *  fields: An array of strings to filter on the populated objects, following Mongoose's select
   *    rules. If each field starts a preceding "-", will act as a block list and only remove those
   *    fields. If each field does not start with a "-", will act as an allow list and only
   *    return those fields. Mixing allow and blocking is not supported. e.g. "-created updated"
   *    is an error.
   *  openApiComponent: If you have a component already registered,
   *    use that instead of autogenerating the types for the populated fields.
   *
   */
  populatePaths?: PopulatePath[];
  /** Default limit applied to list queries if not specified by the user. Defaults to 100. */
  defaultLimit?: number;
  /**
   * Maximum query limit the user can request. Defaults to 500, and is the lowest of the limit
   * query, max limit,
   *  or 500. */
  maxLimit?: number; // defaults to 500
  /** Custom route setup function. Receives the router and optionally the full options (including openApi). */
  endpoints?: (router: express.Router, options?: Partial<ModelRouterOptions<T>>) => void;
  /** Named instance-scoped operations at `/:id/:actionName` (GET or POST). */
  instanceActions?: Record<string, InstanceActionConfig<T, unknown, unknown, unknown>>;
  /** Named collection-scoped operations at `/:actionName` (GET or POST). */
  collectionActions?: Record<string, CollectionActionConfig<unknown, unknown, unknown>>;
  /**
   * Hook that runs after `transformer.transform` but before the object is created.
   * Can update the body fields based on the request or the user.
   * Return null to return a generic 403 error. Throw an APIError to return a 400 with specific
   * error information.
   */
  preCreate?: (
    value: Partial<T> | (Partial<T> | undefined)[] | null | undefined,
    request: express.Request
  ) => T | Promise<T> | null;
  /**
   * Hook that runs after `transformer.transform` but before changes are made for update operations.
   * Can update the body fields based on the request or the user.
   * Also applies to all array operations. Return null to return a generic 403 error.
   * Throw an APIError to return a 400 with specific error information.
   *
   * @param value - The request body relative to the model update (type: Partial<T>). Note: this does not contain the entire document to be updated, only the fields being updated.
   * @param request - The Express request object.
   */
  preUpdate?: (value: Partial<T>, request: express.Request) => T | Promise<T> | null;
  /**
   * Hook that runs after `transformer.transform` but before the object is deleted.
   * Return null to return a generic 403 error.
   * Throw an APIError to return a 400 with specific error information.
   *
   * @param value - The document to be deleted, before the soft update of deleted: true (type: T).
   * @param request - The Express request object.
   */
  preDelete?: (value: T, request: express.Request) => T | Promise<T> | null;
  /**
   * Hook that runs after the object is created but before the responseHandler serializes and
   * returned. This is a good spot to perform dependent changes to other models or performing async
   * tasks/side effects, such as sending a push notification.
   * Throw an APIError to return a 400 with an error message.
   */
  postCreate?: (value: T, request: express.Request) => void | Promise<void>;
  /**
   * Hook that runs after the object is updated but before the responseHandler serializes and
   * returned. This is a good spot to perform dependent changes to other models or perform async
   * tasks/side effects, such as sending a push notification.
   * Throw an APIError to return a 400 with an error message.
   *
   * @param value - The document after it has been updated (type: T).
   * @param cleanedBody - The request body relative to the model update (type: Partial<T>).
   * @param request - The Express request object.
   * @param prevValue - The entire document before it was updated (type: T).
   */
  postUpdate?: (
    value: T,
    cleanedBody: Partial<T>,
    request: express.Request,
    prevValue: T
  ) => void | Promise<void>;
  /**
   * Hook that runs after the object is deleted. This is a good spot to perform dependent changes
   * to other models or performing async tasks/side effects, such as cascading object deletions.
   * Throw an APIError to return a 400 with an error message.
   *
   * @param request - The Express request object.
   * @param value - The document that was deleted, after the soft update of deleted: true (type: T).
   */
  postDelete?: (request: express.Request, value: T) => void | Promise<void>;
  /** Hook that runs after the object is fetched but before it is serialized.
   * Returns a promise so that asynchronous actions can be included in the function.
   * Throw an APIError to return a 400 with an error message.
   * @deprecated: Use responseHandler instead.
   */
  postGet?: (value: T, request: express.Request) => undefined | Promise<T>;
  /** Hook that runs after the list of objects is fetched but before they are serialized.
   * Returns a promise so that asynchronous actions can be included in the function.
   * Throw an APIError to return a 400 with an error message.
   * @deprecated: Use responseHandler instead.
   */
  postList?: (
    value: (Document<unknown, unknown, unknown> & T)[],
    request: express.Request
  ) => Promise<(Document<unknown, unknown, unknown> & T)[]>;
  /**
   * Serialize an object or list of objects before returning to the client.
   * This is a good spot to remove sensitive information from the object, such as passwords or API
   * keys. Throw an APIError to return a 400 with an error message.
   */
  responseHandler?: (
    value: (Document<unknown, unknown, unknown> & T) | (Document<unknown, unknown, unknown> & T)[],
    method: "list" | "create" | "read" | "update" | "delete",
    request: express.Request,
    options: ModelRouterOptions<T>
  ) => Promise<JSONValue>;
  /**
   * The OpenAPI generator for this server. This is used to generate the OpenAPI documentation.
   */
  openApi?: OpenApiMiddleware;
  /**
   * Overwrite parts of the configuration for the OpenAPI generator.
   * This will be merged with the generated configuration.
   */
  openApiOverwrite?: {
    get?: Record<string, unknown>;
    list?: Record<string, unknown>;
    create?: Record<string, unknown>;
    update?: Record<string, unknown>;
    delete?: Record<string, unknown>;
  };
  /**
   * Overwrite parts of the model properties for the OpenAPI generator.
   * This will be merged with the generated configuration.
   * This is useful if you add custom properties to the model during serialize, for example,
   * that you want to be documented and typed in the SDK.
   */
  openApiExtraModelProperties?: Record<string, unknown>;
  /**
   * Enable runtime validation of request bodies against the OpenAPI schema.
   * When enabled, requests that don't match the documented schema will return 400 errors.
   *
   * Can be set to:
   * - `true`: Enable validation for create and update operations
   * - `false`: Disable validation (default)
   * - Object with `validateCreate` and `validateUpdate` booleans for fine-grained control
   *
   * Note: Global validation can be enabled via `configureOpenApiValidator()`.
   * This option overrides the global setting for this specific router.
   */
  validation?: boolean | ModelRouterValidationOptions;
  /**
   * Enable real-time sync for this model via WebSocket events.
   * When configured, CRUD operations will emit events to connected clients
   * through the RealtimeApp plugin's change stream watcher.
   *
   * Requires the RealtimeApp plugin to be registered with TerrenoApp.
   */
  realtime?: RealtimeConfig;
  /**
   * Enable local-first sync (@terreno/syncdb) for this model. Documents are scoped
   * into streams (owner/tenant/broadcast/custom) with monotonic per-stream cursors.
   *
   * Requires the schema to use `isDeletedPlugin` (soft delete tombstones) and
   * `syncPlugin` (per-stream `_syncSeq` stamping) — validated at registration.
   * Only works with the three-argument form: modelRouter('/path', Model, options).
   */
  sync?: SyncConfig;
}

/**
 * Parses a date-range query bound from an ISO-8601 string using Luxon, throwing a 400
 * APIError when the value cannot be parsed. Centralizes date-string parsing so the repo's
 * Luxon convention is honored for admin changelist date-range filters.
 */
const parseDateRangeBound = (rawValue: unknown, queryKey: string): Date => {
  const parsed = DateTime.fromISO(String(rawValue), {zone: "utc"});
  if (!parsed.isValid) {
    throw new APIError({
      status: 400,
      title: `Invalid date for query parameter ${queryKey}`,
    });
  }
  return parsed.toJSDate();
};

/**
 * Collapses `field_gte` / `field_lte` query pairs into `{ field: { $gte, $lte } }` for Date paths,
 * so admin changelist date-range filters map to valid Mongoose range queries.
 */
const mergeDateRangeQueryParams = <T>(
  model: Model<T>,
  query: Record<string, unknown>
): Record<string, unknown> => {
  const schema = model.schema;
  const result: Record<string, unknown> = {...query};
  const dateRangeBases = new Set<string>();
  for (const key of Object.keys(result)) {
    const match = /^(.+)_(gte|lte)$/.exec(key);
    if (!match) {
      continue;
    }
    const baseField = match[1];
    const path = schema.path(baseField);
    if (!path || path.instance !== "Date") {
      continue;
    }
    dateRangeBases.add(baseField);
  }
  for (const baseField of dateRangeBases) {
    const gteKey = `${baseField}_gte`;
    const lteKey = `${baseField}_lte`;
    const gteRaw = result[gteKey];
    const lteRaw = result[lteKey];
    const bounds: {$gte?: Date; $lte?: Date} = {};
    if (gteRaw !== undefined && gteRaw !== null && String(gteRaw).trim() !== "") {
      bounds.$gte = parseDateRangeBound(gteRaw, gteKey);
    }
    if (lteRaw !== undefined && lteRaw !== null && String(lteRaw).trim() !== "") {
      bounds.$lte = parseDateRangeBound(lteRaw, lteKey);
    }
    if (Object.keys(bounds).length === 0) {
      continue;
    }
    delete result[gteKey];
    delete result[lteKey];
    const direct = result[baseField];
    if (direct !== undefined && direct !== null && typeof direct !== "object") {
      delete result[baseField];
    }
    if (typeof direct === "object" && direct !== null && !Array.isArray(direct)) {
      result[baseField] = {...(direct as Record<string, unknown>), ...bounds};
    } else {
      result[baseField] = bounds;
    }
  }
  return result;
};

// Ensures query params are allowed. Also checks nested query params when using $and/$or.
const checkQueryParamAllowed = (
  queryParam: string,
  queryParamValue: unknown,
  queryFields: string[] = []
) => {
  // Cast for iteration through complex query values
  const complexValue = queryParamValue as Array<Record<string, unknown>>;
  // Check the values of each of the complex query params. We don't support recursive queries here,
  // just one level of and/or
  if (COMPLEX_QUERY_PARAMS.includes(queryParam)) {
    // Complex query of the form `$and: [{key1: value1}, {key2: value2}]`
    for (const subQuery of complexValue) {
      for (const subKey of Object.keys(subQuery)) {
        checkQueryParamAllowed(subKey, subQuery[subKey], queryFields);
      }
    }
    return;
  }
  if (!queryFields.includes(queryParam)) {
    throw new APIError({
      status: 400,
      title: `${queryParam} is not allowed as a query param.`,
    });
  }
};

// Handles dot notation patches, creates a normal object to be used for updates.
// function flattenDotNotationPatch(data: any) {
//   const result = {};
//
//   for (const key in data) {
//     if (data.hasOwnProperty(key)) {
//       if (typeof data[key] === "object" && !key.includes(".")) {
//         // If the value is an object and the key does not contain a dot, merge it
//         merge(result, {[key]: data[key]});
//       } else {
//         // Otherwise, use _.set() to handle dot notation
//         set(result, key, data[key]);
//       }
//     }
//   }
//
//   return result;
// }

// Helper to determine if validation should be enabled for a specific operation.
// When options.validation is not set, returns true — the middleware's own
// isConfigured check will decide whether to actually validate.
const shouldValidate = <T>(
  options: ModelRouterOptions<T>,
  operation: "create" | "update" | "query"
): boolean => {
  // Check route-specific validation option first
  if (options.validation !== undefined) {
    if (typeof options.validation === "boolean") {
      return options.validation;
    }
    if (operation === "create") {
      return options.validation.validateCreate ?? true;
    }
    if (operation === "update") {
      return options.validation.validateUpdate ?? true;
    }
    return options.validation.validateQuery ?? true;
  }

  // Default: let middleware's isConfigured check decide
  return true;
};

// Get body validation middleware if validation is enabled
const getBodyValidationMiddleware = <T>(
  model: Model<T>,
  options: ModelRouterOptions<T>,
  operation: "create" | "update"
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const validationOptions: import("./openApiValidator").RequestBodyValidatorOptions = {};
  if (!shouldValidate(options, operation)) {
    validationOptions.enabled = false;
  }
  if (typeof options.validation === "object") {
    if (options.validation.onError) {
      validationOptions.onError = options.validation.onError;
    }
    if (options.validation.onAdditionalPropertiesRemoved) {
      validationOptions.onAdditionalPropertiesRemoved =
        options.validation.onAdditionalPropertiesRemoved;
    }
    const excludeFields =
      operation === "create"
        ? options.validation.excludeFromCreate
        : options.validation.excludeFromUpdate;
    if (excludeFields?.length) {
      validationOptions.excludeFields = excludeFields;
    }
  }

  return validateModelRequestBody(model, validationOptions);
};

// Get query validation middleware if validation is enabled
const getQueryValidationMiddleware = <T>(
  model: Model<T>,
  options: ModelRouterOptions<T>
): ((req: Request, res: Response, next: NextFunction) => void) => {
  const querySchema = buildQuerySchemaFromFields(model, options.queryFields);
  const validationOptions: import("./openApiValidator").QueryValidatorOptions = {};
  if (!shouldValidate(options, "query")) {
    validationOptions.enabled = false;
  }
  if (typeof options.validation === "object" && options.validation.onError) {
    validationOptions.onError = options.validation.onError;
  }

  return validateQueryParams(querySchema, validationOptions);
};

/**
 * Registration object returned by modelRouter when called with a path.
 *
 * Used with `TerrenoApp.register()` to mount model routers at specific paths.
 * Contains the Express router and the path it should be mounted at.
 *
 * @see modelRouter for creating registrations
 * @see TerrenoApp for registering routers
 */
export interface ModelRouterRegistration {
  /** Internal type discriminator for registration detection */
  __type: "modelRouter";
  /** The path where the router should be mounted (e.g., "/todos") */
  path: string;
  /** The Express router containing CRUD endpoints */
  router: express.Router;
  /** @internal Rebuilds the router with the openApi instance injected into options */
  _buildWithOpenApi: (openApi: OpenApiMiddleware) => express.Router;
}

/**
 * Create a set of CRUD routes given a Mongoose model and configuration options.
 *
 * When called with a path as the first argument, returns a `ModelRouterRegistration` that can be
 * passed to `TerrenoApp.register()`.
 *
 * @example
 * // Traditional usage (returns express.Router):
 * router.use("/todos", modelRouter(Todo, options));
 *
 * // Registration usage (returns ModelRouterRegistration):
 * const todoRouter = modelRouter("/todos", Todo, options);
 * app.register(todoRouter);
 */
export function modelRouter<T>(
  path: string,
  model: Model<T>,
  options: ModelRouterOptions<T>
): ModelRouterRegistration;
export function modelRouter<T>(model: Model<T>, options: ModelRouterOptions<T>): express.Router;
export function modelRouter<T>(
  pathOrModel: string | Model<T>,
  modelOrOptions: Model<T> | ModelRouterOptions<T>,
  maybeOptions?: ModelRouterOptions<T>
): express.Router | ModelRouterRegistration {
  let model: Model<T>;
  let options: ModelRouterOptions<T>;
  let path: string | undefined;

  if (typeof pathOrModel === "string") {
    path = pathOrModel;
    model = modelOrOptions as Model<T>;
    options = maybeOptions as ModelRouterOptions<T>;
  } else {
    model = pathOrModel;
    options = modelOrOptions as ModelRouterOptions<T>;
  }

  const router = _buildModelRouter(model, options);

  if (path !== undefined) {
    // Register for real-time sync if configured
    if (options.realtime) {
      registerRealtime({
        collectionName: model.collection.collectionName,
        config: options.realtime,
        modelName: model.modelName,
        options,
        routePath: path,
      });
    }
    // Register for local-first sync if configured (validates the schema contract)
    if (options.sync) {
      registerSync({config: options.sync, model, options, routePath: path});
    }
    return {
      __type: "modelRouter",
      _buildWithOpenApi: (openApi: OpenApiMiddleware) =>
        _buildModelRouter(model, {...options, openApi}),
      path,
      router,
    };
  }

  if (options.realtime) {
    logger.warn(
      `modelRouter for ${model.modelName} has realtime config but was called without a path. ` +
        "Realtime sync only works with the three-argument form: modelRouter('/path', Model, options)"
    );
  }
  if (options.sync) {
    logger.warn(
      `modelRouter for ${model.modelName} has sync config but was called without a path. ` +
        "Local-first sync only works with the three-argument form: modelRouter('/path', Model, options)"
    );
  }

  return router;
}

function _buildModelRouter<T>(model: Model<T>, options: ModelRouterOptions<T>): express.Router {
  const router = express.Router();

  assertNoActionCollisions(model, options);
  registerActionRoutes(router, model, options);

  // User endpoints run after actions; actions win on path conflicts.
  if (options.endpoints) {
    options.endpoints(router, options);
  }

  const responseHandler = options.responseHandler ?? defaultResponseHandler;

  // Always install validation middleware — they are no-ops until configureOpenApiValidator() is called
  const createValidation = getBodyValidationMiddleware(model, options, "create");
  const updateValidation = getBodyValidationMiddleware(model, options, "update");
  const queryValidation = getQueryValidationMiddleware(model, options);

  router.post(
    "/",
    [
      authenticateMiddleware(options.allowAnonymous),
      createOpenApiMiddleware(model, options),
      permissionMiddleware(model, options),
      createValidation,
    ],
    asyncHandler(async (req: Request, res: Response) => {
      let body: Partial<T> | (Partial<T> | undefined)[] | null | undefined;
      try {
        body = transform<T>(options, req.body, "create", req.user);
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
          body = await options.preCreate(body, req);
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
        if (body === undefined) {
          throw new APIError({
            detail: "A body must be returned from preCreate",
            status: 403,
            title: "Create not allowed",
          });
        }
        if (body === null) {
          throw new APIError({
            detail: "preCreate hook returned null",
            status: 403,
            title: "Create not allowed",
          });
        }
      }
      if (body === undefined) {
        throw new APIError({
          detail: "Body is undefined",
          status: 400,
          title: "Invalid request body",
        });
      }
      let data: Document<unknown, unknown, unknown> & T;
      try {
        data = (await model.create(body as T)) as Document<unknown, unknown, unknown> & T;
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

      if (options.postCreate) {
        try {
          await options.postCreate(data, req);
        } catch (error: unknown) {
          throw new APIError({
            disableExternalErrorTracking: getDisableExternalErrorTracking(error),
            error,
            status: 400,
            title: `postCreate hook error: ${errorMessage(error)}`,
          });
        }
      }
      try {
        const serialized = await responseHandler(data, "create", req, options);
        return res.status(201).json({data: serialized});
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          title: `responseHandler error: ${errorMessage(error)}`,
        });
      }
    })
  );

  // TODO add rate limit
  router.get(
    "/",
    [
      authenticateMiddleware(options.allowAnonymous),
      permissionMiddleware(model, options),
      listOpenApiMiddleware(model, options),
      queryValidation,
    ],
    asyncHandler(async (req: Request, res: Response) => {
      let query: Record<string, unknown> = {};
      for (const queryParam of Object.keys(options.defaultQueryParams ?? [])) {
        query[queryParam] = options.defaultQueryParams?.[queryParam];
      }

      for (const queryParam of Object.keys(req.query)) {
        if (PAGINATION_QUERY_PARAMS.includes(queryParam)) {
          continue;
        }
        checkQueryParamAllowed(queryParam, req.query[queryParam], options.queryFields);

        // Not sure if this is necessary or if mongoose does the right thing.
        if (req.query[queryParam] === "true") {
          query[queryParam] = true;
        } else if (req.query[queryParam] === "false") {
          query[queryParam] = false;
        } else {
          query[queryParam] = req.query[queryParam];
        }
      }

      query = mergeDateRangeQueryParams(model, query);

      // Special operators. NOTE: these request Mongo Atlas.
      if (req.query.$search) {
        mongoose.connection.db?.collection(model.collection.collectionName);
      }

      if (req.query.$autocomplete) {
        mongoose.connection.db?.collection(model.collection.collectionName);
      }

      // Check if any of the keys in the query are not allowed by options.queryFilter
      if (options.queryFilter) {
        let queryFilter: Record<string, unknown> | null | undefined;
        try {
          queryFilter = await options.queryFilter(req.user, query);
        } catch (error: unknown) {
          throw new APIError({
            disableExternalErrorTracking: getDisableExternalErrorTracking(error),
            error,
            status: 400,
            title: `Query filter error: ${error}`,
          });
        }

        // If the query filter returns null specifically, we know this is a query that shouldn't
        // return any results.
        if (queryFilter === null) {
          return res.json({data: []});
        }
        query = {...query, ...queryFilter};
      }

      let limit = options.defaultLimit ?? 100;
      if (Number(req.query.limit)) {
        limit = Math.min(Number(req.query.limit), options.maxLimit ?? 500);
      }

      if (query.period) {
        // need to remove 'period' since it isn't part of any schemas but parsed and applied in
        // queryFilter instead
        query.period = undefined;
      }

      let builtQuery = model.find(query).limit(limit + 1);
      const total = await model.countDocuments(query);
      if (req.query.page) {
        if (Number(req.query.page) === 0 || Number.isNaN(Number(req.query.page))) {
          throw new APIError({
            status: 400,
            title: `Invalid page: ${req.query.page}`,
          });
        }
        builtQuery = builtQuery.skip((Number(req.query.page) - 1) * limit);
      }

      // Query param sort takes precedence over options.sort.
      if (req.query.sort) {
        builtQuery = builtQuery.sort(req.query.sort as string);
      } else if (options.sort) {
        builtQuery = builtQuery.sort(options.sort);
      }

      const populatedQuery = addPopulateToQuery(builtQuery, options.populatePaths);

      let data: (Document<unknown, unknown, unknown> & T)[];
      try {
        data = (await populatedQuery.exec()) as (Document<unknown, unknown, unknown> & T)[];
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          title: `List error: ${errorStack(error)}`,
        });
      }

      let serialized: JSONValue | Partial<T> | (Partial<T> | undefined)[] | undefined;

      try {
        serialized = await responseHandler(data, "list", req, options);
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          title: `responseHandler error: ${errorMessage(error)}`,
        });
      }

      let more: boolean | undefined;
      try {
        if (serialized && Array.isArray(serialized)) {
          more = serialized.length === limit + 1 && serialized.length > 0;
          if (more) {
            // Slice off the extra document we fetched to determine if more is true or not.
            serialized = serialized.slice(0, limit);

            if (!req.query.page) {
              const msg = `More than ${limit} results returned for ${model.collection.name} without pagination, data may be silently truncated. req.query: ${JSON.stringify(req.query)}`;
              logger.warn(msg);
              try {
                Sentry.captureMessage(msg);
              } catch (error) {
                logger.error(`Error capturing message: ${error}`);
              }
            }
          }
          return res.json({
            data: serialized,
            limit,
            more,
            page: req.query.page,
            total,
          });
        }
        return res.json({data: serialized});
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          title: `Serialization error: ${errorMessage(error)}`,
        });
      }
    })
  );

  router.get(
    "/:id",
    [
      authenticateMiddleware(options.allowAnonymous),
      getOpenApiMiddleware(model, options),
      permissionMiddleware(model, options),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const data: mongoose.Document & T = (req as Request & {obj: mongoose.Document & T}).obj;

      try {
        const serialized = await responseHandler(data, "read", req, options);
        return res.json({data: serialized});
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          title: `responseHandler error: ${errorMessage(error)}`,
        });
      }
    })
  );

  router.put(
    "/:id",
    authenticateMiddleware(options.allowAnonymous),
    asyncHandler(async (_req: Request, _res: Response) => {
      // Patch is what we want 90% of the time
      throw new APIError({
        title: "PUT is not supported.",
      });
    })
  );

  router.patch(
    "/:id",
    [
      authenticateMiddleware(options.allowAnonymous),
      patchOpenApiMiddleware(model, options),
      permissionMiddleware(model, options),
      updateValidation,
    ],
    asyncHandler(async (req: Request, res: Response) => {
      let doc: mongoose.Document & T = (req as Request & {obj: mongoose.Document & T}).obj;

      let body: Partial<T> | T | null | undefined;

      try {
        body = transform<T>(options, req.body, "update", req.user) as Partial<T>;
      } catch (error: unknown) {
        if (isAPIError(error)) {
          throw error;
        }
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          status: 403,
          title: `PATCH failed on ${req.params.id} for user ${req.user?.id}: ${errorMessage(error)}`,
        });
      }

      // Remove _updatedAt from body before preUpdate processes it
      const bodyUpdatedAt = req.body._updatedAt;
      delete req.body._updatedAt;
      if (body && typeof body === "object") {
        delete (body as Record<string, unknown>)._updatedAt;
      }

      if (options.preUpdate) {
        try {
          body = await options.preUpdate(body, req);
        } catch (error: unknown) {
          if (isAPIError(error)) {
            throw error;
          }
          throw new APIError({
            disableExternalErrorTracking: getDisableExternalErrorTracking(error),
            error,
            status: 400,
            title: `preUpdate hook error on ${req.params.id}: ${errorMessage(error)}`,
          });
        }
        if (body === undefined) {
          throw new APIError({
            detail: "A body must be returned from preUpdate",
            status: 403,
            title: "Update not allowed",
          });
        }
        if (body === null) {
          throw new APIError({
            detail: `preUpdate hook on ${req.params.id} returned null`,
            status: 403,
            title: "Update not allowed",
          });
        }
      }

      // Conflict detection runs after preUpdate so that unauthorized mutations
      // are rejected before we leak document data in a 409 response.
      const preciseUnmodifiedSince = req.headers["x-unmodified-since-iso"];
      const httpUnmodifiedSince = req.headers["if-unmodified-since"];
      const timestampValue = Array.isArray(preciseUnmodifiedSince)
        ? preciseUnmodifiedSince[0]
        : preciseUnmodifiedSince;
      const httpTimestampValue = Array.isArray(httpUnmodifiedSince)
        ? httpUnmodifiedSince[0]
        : httpUnmodifiedSince;
      if (timestampValue || httpTimestampValue || bodyUpdatedAt) {
        const usingPreciseHeader = Boolean(timestampValue);
        const usingHttpHeader = !usingPreciseHeader && Boolean(httpTimestampValue);
        const clientTimestamp = timestampValue
          ? DateTime.fromISO(timestampValue)
          : httpTimestampValue
            ? DateTime.fromHTTP(httpTimestampValue)
            : DateTime.fromISO(bodyUpdatedAt);

        if (!clientTimestamp.isValid) {
          throw new APIError({
            detail: usingPreciseHeader
              ? "X-Unmodified-Since-ISO header could not be parsed as an ISO date"
              : usingHttpHeader
                ? "If-Unmodified-Since header could not be parsed as an HTTP date"
                : "_updatedAt body field could not be parsed as an ISO date",
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
          const serialized = await responseHandler(doc, "update", req, options);
          return res.status(409).json({
            data: serialized,
            error: "Conflict",
            message: "Document was modified since your last read",
          });
        }
      }

      // Make a copy for passing pre-saved values to hooks.
      const prevDoc = cloneDeep(doc);

      // Using .save here runs the risk of a versioning error if you try to make two simultaneous
      // updates. We won't wind up with corrupted data, just an API error.
      try {
        doc.set(body);
        await doc.save();
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          status: 400,
          title: `preUpdate hook save error on ${req.params.id}: ${errorMessage(error)}`,
        });
      }

      if (options.populatePaths) {
        // biome-ignore lint/suspicious/noExplicitAny: mongoose Query type varies based on populatePaths
        let populateQuery: any = model.findById(doc._id);
        populateQuery = addPopulateToQuery(populateQuery, options.populatePaths);
        doc = await populateQuery.exec();
      }

      if (options.postUpdate) {
        try {
          await options.postUpdate(doc, body, req, prevDoc);
        } catch (error: unknown) {
          throw new APIError({
            disableExternalErrorTracking: getDisableExternalErrorTracking(error),
            error,
            status: 400,
            title: `postUpdate hook error on ${req.params.id}: ${errorMessage(error)}`,
          });
        }
      }

      try {
        const serialized = await responseHandler(doc, "update", req, options);
        return res.json({data: serialized});
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          title: `responseHandler error: ${errorMessage(error)}`,
        });
      }
    })
  );

  router.delete(
    "/:id",
    [
      authenticateMiddleware(options.allowAnonymous),
      deleteOpenApiMiddleware(model, options),
      permissionMiddleware(model, options),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const doc: mongoose.Document & T & {deleted?: boolean} = (
        req as Request & {obj: mongoose.Document & T & {deleted?: boolean}}
      ).obj;

      if (options.preDelete) {
        let body: T | null | undefined;
        try {
          body = await options.preDelete(doc, req);
        } catch (error: unknown) {
          if (isAPIError(error)) {
            throw error;
          }
          throw new APIError({
            disableExternalErrorTracking: getDisableExternalErrorTracking(error),
            error,
            status: 403,
            title: `preDelete hook error on ${req.params.id}: ${errorMessage(error)}`,
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
            detail: `preDelete hook for ${req.params.id} returned null`,
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

      if (options.postDelete) {
        try {
          await options.postDelete(req, doc);
        } catch (error: unknown) {
          throw new APIError({
            disableExternalErrorTracking: getDisableExternalErrorTracking(error),
            error,
            status: 400,
            title: `postDelete hook error: ${errorMessage(error)}`,
          });
        }
      }

      return res.status(204).json({});
    })
  );

  async function arrayOperation(
    req: Request,
    res: Response,
    operation: "POST" | "PATCH" | "DELETE"
  ) {
    // TODO Combine array operations and .patch(), as they are very similar.

    if (!(await checkPermissions("update", options.permissions.update, req.user))) {
      throw new APIError({
        status: 405,
        title: `Access to PATCH on ${model.modelName} denied for ${req.user?.id}`,
      });
    }

    const doc = await model.findById(req.params.id);
    // Make a copy for passing pre-saved values to hooks.
    const prevDoc = cloneDeep(doc);
    if (!doc) {
      throw new APIError({
        status: 404,
        title: `Could not find document to PATCH: ${req.params.id}`,
      });
    }

    if (!(await checkPermissions("update", options.permissions.update, req.user, doc))) {
      throw new APIError({
        status: 403,
        title: `Patch not allowed for user ${req.user?.id} on doc ${doc._id}`,
      });
    }

    const field = req.params.field as string;
    const itemId = req.params.itemId as string;

    // We apply the operation *before* the hooks. As far as the callers are concerned, this should
    // be like PATCHing the field and replacing the whole thing.
    if (operation !== "DELETE" && req.body[field] === undefined) {
      throw new APIError({
        status: 400,
        title: `Malformed body, array operations should have a single, top level key, got: ${Object.keys(
          req.body
        ).join(",")}`,
      });
    }

    const array = [...(doc as unknown as Record<string, unknown[]>)[field]];
    if (operation === "POST") {
      array.push(req.body[field]);
    } else if (operation === "PATCH" || operation === "DELETE") {
      // Check for subschema vs String array:
      let index: number;
      if (isValidObjectId(itemId)) {
        index = array.findIndex((x) => (x as {id?: string})?.id === itemId);
      } else {
        index = array.indexOf(itemId);
      }
      if (index === -1) {
        throw new APIError({
          status: 404,
          title: `Could not find ${field}/${itemId}`,
        });
      }
      // For PATCHing an item by ID, we need to merge the objects so we don't override the _id or
      // other parts of the subdocument.
      if (operation === "PATCH" && isValidObjectId(itemId)) {
        Object.assign(array[index] as object, req.body[field]);
      } else if (operation === "PATCH") {
        // For PATCHing a string array, we can replace the whole object.
        array[index] = req.body[field];
      } else {
        array.splice(index, 1);
      }
    } else {
      throw new APIError({
        status: 400,
        title: `Invalid array operation: ${operation}`,
      });
    }
    let body: Partial<T> | null = {[field]: array} as unknown as Partial<T>;

    try {
      body = transform<T>(options, body, "update", req.user) as Partial<T>;
    } catch (error: unknown) {
      if (isAPIError(error)) {
        throw error;
      }
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 403,
        title: errorMessage(error),
      });
    }

    if (options.preUpdate) {
      try {
        body = await options.preUpdate(body, req);
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          status: 400,
          title: `preUpdate hook error on ${req.params.id}: ${errorMessage(error)}`,
        });
      }
      if (body === undefined) {
        throw new APIError({
          detail: "A body must be returned from preUpdate",
          status: 403,
          title: "Update not allowed",
        });
      }
      if (body === null) {
        throw new APIError({
          detail: `preUpdate hook on ${req.params.id} returned null`,
          status: 403,
          title: "Update not allowed",
        });
      }
    }

    // Using .save here runs the risk of a versioning error if you try to make two simultaneous
    // updates. We won't wind up with corrupted data, just an API error.
    try {
      Object.assign(doc, body);
      await doc.save();
    } catch (error: unknown) {
      throw new APIError({
        disableExternalErrorTracking: getDisableExternalErrorTracking(error),
        error,
        status: 400,
        title: `PATCH Pre Update error on ${req.params.id}: ${errorMessage(error)}`,
      });
    }

    if (options.postUpdate) {
      try {
        await options.postUpdate(
          doc as unknown as Document<unknown, unknown, unknown> & T,
          body,
          req,
          prevDoc as unknown as T
        );
      } catch (error: unknown) {
        throw new APIError({
          disableExternalErrorTracking: getDisableExternalErrorTracking(error),
          error,
          status: 400,
          title: `PATCH Post Update error on ${req.params.id}: ${errorMessage(error)}`,
        });
      }
    }
    return res.json({
      data: serialize<T>(req, options, doc as unknown as Document<unknown, unknown, unknown> & T),
    });
  }

  async function arrayPost(req: Request, res: Response) {
    return arrayOperation(req, res, "POST");
  }

  async function arrayPatch(req: Request, res: Response) {
    return arrayOperation(req, res, "PATCH");
  }

  async function arrayDelete(req: Request, res: Response) {
    return arrayOperation(req, res, "DELETE");
  }
  // Set up routes for managing array fields. Check if there any array fields to add this for.
  if (Object.values(model.schema.paths).find((config) => config.instance === "Array")) {
    router.post(
      "/:id/:field",
      authenticateMiddleware(options.allowAnonymous),
      asyncHandler(arrayPost)
    );
    router.patch(
      "/:id/:field/:itemId",
      authenticateMiddleware(options.allowAnonymous),
      asyncHandler(arrayPatch)
    );
    router.delete(
      "/:id/:field/:itemId",
      authenticateMiddleware(options.allowAnonymous),
      asyncHandler(arrayDelete)
    );
  }
  router.use(apiErrorMiddleware);

  return router;
}

/**
 * Options for the asyncHandler function.
 */
export interface AsyncHandlerOptions {
  /**
   * Schema for validating request body.
   * When provided and validation is enabled, the request body will be validated
   * against this schema before the handler runs.
   */
  bodySchema?: Record<string, import("./openApiBuilder").OpenApiSchemaProperty>;

  /**
   * Schema for validating query parameters.
   * When provided and validation is enabled, query params will be validated
   * against this schema before the handler runs.
   */
  querySchema?: Record<string, import("./openApiBuilder").OpenApiSchemaProperty>;

  /**
   * Override global validation setting for this handler.
   * - `true`: Enable validation regardless of global setting
   * - `false`: Disable validation regardless of global setting
   * - `undefined`: Use global setting
   */
  validate?: boolean;
}

/**
 * Wraps async route handlers to properly catch and forward errors.
 *
 * Since Express doesn't handle async routes well, wrap them with this function.
 * Optionally supports integrated request validation.
 *
 * @param fn - The async route handler function
 * @param options - Optional configuration for validation
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // Basic usage without validation
 * router.post("/users", asyncHandler(async (req, res) => {
 *   // handler code
 * }));
 *
 * // With integrated validation
 * router.post("/users", asyncHandler(async (req, res) => {
 *   // handler code - body is already validated
 * }, {
 *   bodySchema: {
 *     name: {type: "string", required: true},
 *     email: {type: "string", format: "email", required: true},
 *   },
 *   validate: true,
 * }));
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: handlers may have narrower Request<Params> generics — Express's overload signature uses any for the same reason
type AsyncHandlerFn = (req: any, res: Response, next: NextFunction) => Promise<unknown> | unknown;

export const asyncHandler = (fn: AsyncHandlerFn, options?: AsyncHandlerOptions) => {
  // If no validation options, return simple handler
  if (!options?.bodySchema && !options?.querySchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Import validation functions dynamically to avoid circular deps at module load
  const {
    validateRequestBody,
    validateQueryParams,
    getOpenApiValidatorConfig,
  } = require("./openApiValidator");

  // Build validation middleware
  const validators: ((req: Request, res: Response, next: NextFunction) => void)[] = [];

  // Determine if validation should be enabled
  const shouldValidate = options.validate ?? getOpenApiValidatorConfig().validateRequests ?? false;

  if (shouldValidate) {
    if (options.bodySchema) {
      validators.push(validateRequestBody(options.bodySchema, {enabled: true}));
    }
    if (options.querySchema) {
      validators.push(validateQueryParams(options.querySchema, {enabled: true}));
    }
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // Run validators sequentially, then the handler
    const runValidators = (index: number): void => {
      if (index >= validators.length) {
        // All validators passed, run the actual handler
        Promise.resolve(fn(req, res, next)).catch(next);
        return;
      }

      try {
        validators[index](req, res, ((err?: unknown) => {
          if (err) {
            next(err);
            return;
          }
          runValidators(index + 1);
        }) as NextFunction);
      } catch (err) {
        next(err);
      }
    };

    runValidators(0);
  };
};

// For backwards compatibility with the old names.
export const gooseRestRouter = modelRouter;
export type GooseRESTOptions<T> = ModelRouterOptions<T>;
