import {addPopulateToQuery, type JSONValue} from "../api";
import type {User} from "../auth";
import {checkPermissions} from "../permissions";
import type {PopulatePath} from "../populate";
import {defaultResponseHandler, transform} from "../transformers";
import type {MCPMethod, MCPRegistryEntry} from "./types";

const stripExcludedFields = (data: any, excludeFields: string[]): any => {
  if (!excludeFields.length || !data) {
    return data;
  }

  const strip = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(strip);
    }
    if (obj && typeof obj === "object") {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (!excludeFields.includes(key)) {
          result[key] = value;
        }
      }
      return result;
    }
    return obj;
  };

  return strip(data);
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

const serializeResponse = async (
  data: any,
  method: MCPMethod,
  entry: MCPRegistryEntry,
  user?: User
): Promise<JSONValue> => {
  const excludeFields = entry.config.excludeFields ?? [];

  if (entry.config.mcpResponseHandler) {
    const result = await entry.config.mcpResponseHandler(data, method, user);
    return stripExcludedFields(result, excludeFields);
  }

  // Use the model router's responseHandler if available, otherwise default
  const responseHandler = entry.options.responseHandler ?? defaultResponseHandler;

  // Create a minimal fake request for the response handler
  const fakeReq = {user} as any;
  // responseHandler expects method to be "list" | "create" | "read" | "update" | "delete"
  const result = await responseHandler(data, method as any, fakeReq, entry.options);
  return stripExcludedFields(result, excludeFields);
};

export const handleList = async (
  entry: MCPRegistryEntry,
  args: Record<string, any>,
  user?: User
): Promise<{content: Array<{type: "text"; text: string}>}> => {
  const {model, config, options} = entry;
  const maxLimit = config.maxLimit ?? 50;

  // Check permissions
  if (!(await checkPermissions("list", options.permissions.list, user))) {
    return errorResult("Permission denied: cannot list");
  }

  // Build query from args
  let query: Record<string, any> = {};

  // Apply default query params
  if (options.defaultQueryParams) {
    query = {...options.defaultQueryParams};
  }

  // Apply filter fields from args
  const reservedKeys = new Set(["limit", "page", "sort", "populate"]);
  for (const [key, value] of Object.entries(args)) {
    if (!reservedKeys.has(key) && value !== undefined) {
      query[key] = value;
    }
  }

  // Apply query filter
  if (options.queryFilter) {
    const filtered = await options.queryFilter(user, query);
    if (filtered === null) {
      return textResult(JSON.stringify({data: [], more: false, page: 1, total: 0}));
    }
    query = {...query, ...filtered};
  }

  // Pagination
  const limit = Math.min(Number(args.limit) || maxLimit, maxLimit);
  const page = Number(args.page) || 1;

  let builtQuery = model.find(query).limit(limit + 1);
  const total = await model.countDocuments(query);

  if (page > 1) {
    builtQuery = builtQuery.skip((page - 1) * limit);
  }

  // Sort
  if (args.sort) {
    builtQuery = builtQuery.sort(args.sort);
  } else if (options.sort) {
    builtQuery = builtQuery.sort(options.sort);
  }

  // Populate
  const populatePaths = parsePopulate(args.populate, options.populatePaths);
  const populatedQuery = addPopulateToQuery(builtQuery, populatePaths);

  const data = await populatedQuery.exec();
  const more = data.length > limit;
  const sliced = more ? data.slice(0, limit) : data;

  const serialized = await serializeResponse(sliced, "list", entry, user);

  return textResult(JSON.stringify({data: serialized, more, page, total}));
};

export const handleRead = async (
  entry: MCPRegistryEntry,
  args: Record<string, any>,
  user?: User
): Promise<{content: Array<{type: "text"; text: string}>}> => {
  const {model, options} = entry;

  // Check method-level permission
  if (!(await checkPermissions("read", options.permissions.read, user))) {
    return errorResult("Permission denied: cannot read");
  }

  const populatePaths = parsePopulate(args.populate, options.populatePaths);
  const builtQuery = model.findById(args.id);
  const populatedQuery = addPopulateToQuery(builtQuery as any, populatePaths);
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
  args: Record<string, any>,
  user?: User
): Promise<{content: Array<{type: "text"; text: string}>}> => {
  const {model, options} = entry;

  if (!(await checkPermissions("create", options.permissions.create, user))) {
    return errorResult("Permission denied: cannot create");
  }

  let body: any = transform(options, args, "create", user);

  if (options.preCreate) {
    const fakeReq = {user} as any;
    body = await options.preCreate(body, fakeReq);
    if (body === null || body === undefined) {
      return errorResult("Create not allowed");
    }
  }

  let data;
  try {
    data = await model.create(body);
  } catch (error: any) {
    return errorResult(`Create failed: ${error.message}`);
  }

  if (options.populatePaths) {
    const populateQuery = addPopulateToQuery(
      model.findById(data._id) as any,
      options.populatePaths
    );
    data = await populateQuery.exec();
  }

  if (options.postCreate) {
    const fakeReq = {user} as any;
    await options.postCreate(data, fakeReq);
  }

  const serialized = await serializeResponse(data, "create", entry, user);
  return textResult(JSON.stringify({data: serialized}));
};

export const handleUpdate = async (
  entry: MCPRegistryEntry,
  args: Record<string, any>,
  user?: User
): Promise<{content: Array<{type: "text"; text: string}>}> => {
  const {model, options} = entry;
  const {id, ...updateFields} = args;

  if (!(await checkPermissions("update", options.permissions.update, user))) {
    return errorResult("Permission denied: cannot update");
  }

  const builtQuery = addPopulateToQuery(model.findById(id) as any, options.populatePaths);
  let doc: any = await builtQuery.exec();

  if (!doc) {
    return errorResult(`Document ${id} not found`);
  }

  if (!(await checkPermissions("update", options.permissions.update, user, doc))) {
    return errorResult("Permission denied: cannot update this document");
  }

  let body: any = transform(options, updateFields, "update", user);

  if (options.preUpdate) {
    const fakeReq = {user} as any;
    body = await options.preUpdate(body, fakeReq);
    if (body === null || body === undefined) {
      return errorResult("Update not allowed");
    }
  }

  const prevDoc = doc.toObject();

  try {
    doc.set(body);
    await doc.save();
  } catch (error: any) {
    return errorResult(`Update failed: ${error.message}`);
  }

  if (options.populatePaths) {
    const populateQuery = addPopulateToQuery(model.findById(doc._id) as any, options.populatePaths);
    doc = await populateQuery.exec();
  }

  if (options.postUpdate) {
    const fakeReq = {user} as any;
    await options.postUpdate(doc, body, fakeReq, prevDoc);
  }

  const serialized = await serializeResponse(doc, "update", entry, user);
  return textResult(JSON.stringify({data: serialized}));
};

export const handleDelete = async (
  entry: MCPRegistryEntry,
  args: Record<string, any>,
  user?: User
): Promise<{content: Array<{type: "text"; text: string}>}> => {
  const {model, options} = entry;
  const {id} = args;

  if (!(await checkPermissions("delete", options.permissions.delete, user))) {
    return errorResult("Permission denied: cannot delete");
  }

  const doc: any = await model.findById(id);

  if (!doc) {
    return errorResult(`Document ${id} not found`);
  }

  if (!(await checkPermissions("delete", options.permissions.delete, user, doc))) {
    return errorResult("Permission denied: cannot delete this document");
  }

  if (options.preDelete) {
    const fakeReq = {user} as any;
    const result = await options.preDelete(doc, fakeReq);
    if (result === null || result === undefined) {
      return errorResult("Delete not allowed");
    }
  }

  // Support soft delete via isDeleted plugin
  if (
    Object.keys(model.schema.paths).includes("deleted") &&
    model.schema.paths.deleted.instance === "Boolean"
  ) {
    doc.deleted = true;
    await doc.save();
  } else {
    await doc.deleteOne();
  }

  if (options.postDelete) {
    const fakeReq = {user} as any;
    await options.postDelete(fakeReq, doc);
  }

  return textResult(JSON.stringify({success: true}));
};

const textResult = (text: string) => ({
  content: [{text, type: "text" as const}],
});

const errorResult = (message: string) => ({
  content: [{text: JSON.stringify({error: message}), type: "text" as const}],
  isError: true,
});
