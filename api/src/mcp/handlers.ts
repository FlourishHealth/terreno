import type express from "express";

import {addPopulateToQuery, type JSONValue} from "../api";
import type {User} from "../auth";
import {checkPermissions} from "../permissions";
import type {PopulatePath} from "../populate";
import {defaultResponseHandler, transform} from "../transformers";
import {buildListQuery} from "./query";
import type {
  MCPDocument,
  MCPMethod,
  MCPRegistryEntry,
  MCPRequest,
  MCPToolArgs,
  MCPToolResult,
} from "./types";

/** Methods whose responses go through a responseHandler (delete returns only a status). */
type SerializableMCPMethod = Exclude<MCPMethod, "delete">;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/** Mongoose documents only expose their fields through toObject(). */
const toPlain = (value: unknown): unknown => {
  if (isPlainObject(value) && typeof value.toObject === "function") {
    return (value.toObject as () => unknown)();
  }
  return value;
};

/**
 * Values that serialize themselves — ObjectId, Date, Decimal128, Buffer — must be passed
 * through untouched. Rebuilding them entry by entry would replace an ObjectId with its
 * raw `{buffer: ...}` internals and a Date with `{}`.
 */
const isSelfSerializing = (value: Record<string, unknown>): boolean => {
  return typeof value.toJSON === "function";
};

/**
 * Delete a dot-notation path, descending into arrays element-wise so paths through
 * arrays of subdocuments (e.g. "items.secret") are removed from every element.
 */
const deleteAtPath = (obj: unknown, segments: string[]): void => {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      deleteAtPath(item, segments);
    }
    return;
  }
  if (!isPlainObject(obj) || segments.length === 0) {
    return;
  }
  const [head, ...rest] = segments;
  if (rest.length === 0) {
    delete obj[head];
    return;
  }
  deleteAtPath(obj[head], rest);
};

/**
 * Remove excluded fields from an MCP response.
 *
 * Bare field names are removed at every depth (including inside arrays and populated
 * refs) so a redacted name never leaks through a nested document. Use a dot-notation
 * path when only one specific location should be removed.
 */
const stripExcludedFields = (data: unknown, excludeFields: string[]): unknown => {
  if (!excludeFields.length || !data) {
    return data;
  }

  const bareKeys = new Set(excludeFields.filter((field) => !field.includes(".")));
  const dotPaths = excludeFields
    .filter((field) => field.includes("."))
    .map((field) => field.split("."));

  const strip = (value: unknown): unknown => {
    const plain = toPlain(value);
    if (Array.isArray(plain)) {
      return plain.map(strip);
    }
    if (!isPlainObject(plain) || isSelfSerializing(plain)) {
      return plain;
    }
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(plain)) {
      if (bareKeys.has(key)) {
        continue;
      }
      result[key] = strip(nested);
    }
    return result;
  };

  const stripped = strip(data);
  for (const segments of dotPaths) {
    deleteAtPath(stripped, segments);
  }
  return stripped;
};

const parsePopulate = (
  populateStr: string | undefined,
  defaultPaths?: PopulatePath[]
): PopulatePath[] => {
  const paths = defaultPaths ? [...defaultPaths] : [];
  if (populateStr) {
    const extraPaths = populateStr
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    for (const path of extraPaths) {
      if (!paths.some((p) => p.path === path)) {
        paths.push({path});
      }
    }
  }
  return paths;
};

const asOptionalString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

/** Mongoose's populated query result types don't narrow to a single document. */
const asDocument = (result: unknown): MCPDocument | null => {
  return (result ?? null) as MCPDocument | null;
};

/**
 * Build the Express-shaped request handed to lifecycle hooks and response handlers.
 *
 * An MCP tool call is JSON-RPC, not HTTP, so there is no real request to forward. The
 * authenticated user is the only field with a genuine equivalent — everything else is
 * filled in with empty defaults so hooks that read `req.body`, `req.query`, `req.params`,
 * or `req.headers` get the shape they expect instead of a TypeError. `isMCPRequest` lets
 * a hook detect the MCP path when it needs to behave differently from HTTP.
 */
export const createMCPRequest = ({
  args = {},
  user,
}: {
  args?: MCPToolArgs;
  user?: User;
}): express.Request => {
  const request: MCPRequest = {
    body: args,
    headers: {},
    isMCPRequest: true,
    method: "MCP",
    params: {},
    query: {},
    user,
  };
  return request as unknown as express.Request;
};

const serializeResponse = async (
  data: unknown,
  method: SerializableMCPMethod,
  entry: MCPRegistryEntry,
  user?: User
): Promise<JSONValue> => {
  const excludeFields = entry.config.excludeFields ?? [];

  if (entry.config.mcpResponseHandler) {
    const result = await entry.config.mcpResponseHandler(data, method, user);
    return stripExcludedFields(result, excludeFields) as JSONValue;
  }

  // Use the model router's responseHandler if available, otherwise default
  const responseHandler = entry.options.responseHandler ?? defaultResponseHandler;

  const result = await responseHandler(data, method, createMCPRequest({user}), entry.options);
  return stripExcludedFields(result, excludeFields) as JSONValue;
};

export const handleList = async (
  entry: MCPRegistryEntry,
  args: MCPToolArgs,
  user?: User
): Promise<MCPToolResult> => {
  const {model, config, options} = entry;
  const maxLimit = config.maxLimit ?? 50;

  // Check permissions
  if (!(await checkPermissions("list", options.permissions.list, user))) {
    return errorResult("Permission denied: cannot list");
  }

  // Build query from args — only fields in queryFields, with an allowlist of operators
  const {error: queryError, query: builtFilter} = buildListQuery({args, config, options});
  if (queryError || !builtFilter) {
    return errorResult(queryError ?? "Could not build query");
  }
  let query: Record<string, unknown> = builtFilter;

  // Apply query filter
  if (options.queryFilter) {
    const filtered = await options.queryFilter(user, query);
    if (filtered === null) {
      return textResult(JSON.stringify({data: [], more: false, page: 1, total: 0}));
    }
    query = {...query, ...filtered};
  }

  // Pagination
  const limit = Math.max(1, Math.min(Number(args.limit) || maxLimit, maxLimit));
  const page = Math.max(1, Number(args.page) || 1);

  let builtQuery = model.find(query).limit(limit + 1);
  const total = await model.countDocuments(query);

  if (page > 1) {
    builtQuery = builtQuery.skip((page - 1) * limit);
  }

  // Sort
  const sort = asOptionalString(args.sort) ?? options.sort;
  if (sort) {
    builtQuery = builtQuery.sort(sort);
  }

  // Populate
  const populatePaths = parsePopulate(asOptionalString(args.populate), options.populatePaths);
  const populatedQuery = addPopulateToQuery(builtQuery, populatePaths);

  const data = await populatedQuery.exec();
  const more = data.length > limit;
  const sliced = more ? data.slice(0, limit) : data;

  const serialized = await serializeResponse(sliced, "list", entry, user);

  return textResult(JSON.stringify({data: serialized, more, page, total}));
};

export const handleRead = async (
  entry: MCPRegistryEntry,
  args: MCPToolArgs,
  user?: User
): Promise<MCPToolResult> => {
  const {model, options} = entry;

  // Check method-level permission
  if (!(await checkPermissions("read", options.permissions.read, user))) {
    return errorResult("Permission denied: cannot read");
  }

  const populatePaths = parsePopulate(asOptionalString(args.populate), options.populatePaths);
  const populatedQuery = addPopulateToQuery(model.findById(args.id), populatePaths);
  const data = await populatedQuery.exec();

  if (!data) {
    return errorResult(`Document ${args.id} not found`);
  }

  // Check object-level permission
  if (!(await checkPermissions("read", options.permissions.read, user, data))) {
    return errorResult("Permission denied: cannot read this document");
  }

  const serialized = await serializeResponse(data, "read", entry, user);
  return textResult(JSON.stringify({data: serialized}));
};

export const handleCreate = async (
  entry: MCPRegistryEntry,
  args: MCPToolArgs,
  user?: User
): Promise<MCPToolResult> => {
  const {model, options} = entry;

  if (!(await checkPermissions("create", options.permissions.create, user))) {
    return errorResult("Permission denied: cannot create");
  }

  let body: MCPToolArgs | null;
  try {
    body = transform(options, args, "create", user) as MCPToolArgs;
  } catch (error) {
    return errorResult(`Transform failed: ${errorMessage(error)}`);
  }

  if (options.preCreate) {
    try {
      body = await options.preCreate(body, createMCPRequest({args, user}));
      if (body === null || body === undefined) {
        return errorResult("Create not allowed");
      }
    } catch (error) {
      return errorResult(`preCreate hook failed: ${errorMessage(error)}`);
    }
  }

  let data: MCPDocument | null;
  try {
    data = asDocument(await model.create(body));
  } catch (error) {
    return errorResult(`Create failed: ${errorMessage(error)}`);
  }

  if (options.populatePaths) {
    const populateQuery = addPopulateToQuery(model.findById(data?._id), options.populatePaths);
    data = asDocument(await populateQuery.exec());
  }

  if (options.postCreate) {
    try {
      await options.postCreate(data, createMCPRequest({args, user}));
    } catch (error) {
      return errorResult(`postCreate hook failed: ${errorMessage(error)}`);
    }
  }

  const serialized = await serializeResponse(data, "create", entry, user);
  return textResult(JSON.stringify({data: serialized}));
};

export const handleUpdate = async (
  entry: MCPRegistryEntry,
  args: MCPToolArgs,
  user?: User
): Promise<MCPToolResult> => {
  const {model, options} = entry;
  const {id, ...updateFields} = args;

  if (!(await checkPermissions("update", options.permissions.update, user))) {
    return errorResult("Permission denied: cannot update");
  }

  const builtQuery = addPopulateToQuery(model.findById(id), options.populatePaths);
  let doc = asDocument(await builtQuery.exec());

  if (!doc) {
    return errorResult(`Document ${id} not found`);
  }

  if (!(await checkPermissions("update", options.permissions.update, user, doc))) {
    return errorResult("Permission denied: cannot update this document");
  }

  let body: MCPToolArgs | null;
  try {
    body = transform(options, updateFields, "update", user) as MCPToolArgs;
  } catch (error) {
    return errorResult(`Transform failed: ${errorMessage(error)}`);
  }

  if (options.preUpdate) {
    try {
      body = await options.preUpdate(body, createMCPRequest({args: updateFields, user}));
      if (body === null || body === undefined) {
        return errorResult("Update not allowed");
      }
    } catch (error) {
      return errorResult(`preUpdate hook failed: ${errorMessage(error)}`);
    }
  }

  const prevDoc = doc.toObject();

  try {
    doc.set(body);
    await doc.save();
  } catch (error) {
    return errorResult(`Update failed: ${errorMessage(error)}`);
  }

  if (options.populatePaths) {
    const populateQuery = addPopulateToQuery(model.findById(doc._id), options.populatePaths);
    doc = asDocument(await populateQuery.exec());
  }

  if (options.postUpdate) {
    try {
      await options.postUpdate(doc, body, createMCPRequest({args: updateFields, user}), prevDoc);
    } catch (error) {
      return errorResult(`postUpdate hook failed: ${errorMessage(error)}`);
    }
  }

  const serialized = await serializeResponse(doc, "update", entry, user);
  return textResult(JSON.stringify({data: serialized}));
};

export const handleDelete = async (
  entry: MCPRegistryEntry,
  args: MCPToolArgs,
  user?: User
): Promise<MCPToolResult> => {
  const {model, options} = entry;
  const {id} = args;

  if (!(await checkPermissions("delete", options.permissions.delete, user))) {
    return errorResult("Permission denied: cannot delete");
  }

  // Populate before the object-level permission check so custom permissions can inspect
  // populated refs, matching handleRead/handleUpdate and REST's permissionMiddleware.
  const builtQuery = addPopulateToQuery(model.findById(id), options.populatePaths);
  const doc = asDocument(await builtQuery.exec());

  if (!doc) {
    return errorResult(`Document ${id} not found`);
  }

  if (!(await checkPermissions("delete", options.permissions.delete, user, doc))) {
    return errorResult("Permission denied: cannot delete this document");
  }

  if (options.preDelete) {
    try {
      const result = await options.preDelete(doc, createMCPRequest({args, user}));
      if (result === null || result === undefined) {
        return errorResult("Delete not allowed");
      }
    } catch (error) {
      return errorResult(`preDelete hook failed: ${errorMessage(error)}`);
    }
  }

  // Support soft delete via isDeleted plugin
  try {
    if (
      Object.keys(model.schema.paths).includes("deleted") &&
      model.schema.paths.deleted.instance === "Boolean"
    ) {
      doc.deleted = true;
      await doc.save();
    } else {
      await doc.deleteOne();
    }
  } catch (error) {
    return errorResult(`Delete failed: ${errorMessage(error)}`);
  }

  if (options.postDelete) {
    try {
      await options.postDelete(createMCPRequest({args, user}), doc);
    } catch (error) {
      return errorResult(`postDelete hook failed: ${errorMessage(error)}`);
    }
  }

  return textResult(JSON.stringify({success: true}));
};

const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const textResult = (text: string): MCPToolResult => ({
  content: [{text, type: "text" as const}],
});

const errorResult = (message: string): MCPToolResult => ({
  content: [{text: JSON.stringify({error: message}), type: "text" as const}],
  isError: true,
});
