import type {Tool} from "@modelcontextprotocol/sdk/types.js";

import {applicationInfo} from "./tools/applicationInfo.js";
import {databaseQuery} from "./tools/databaseQuery.js";
import {databaseSchema} from "./tools/databaseSchema.js";
import {lastError, readLogs} from "./tools/readLogs.js";
import {evaluate, getRtkState, navigate} from "./tools/runtime.js";

export const localMcpTools: Tool[] = [
  {
    description:
      "Read the consumer app's package.json workspaces and key dependency versions (@terreno/*, Expo, React Native, Mongoose). Call at the start of each chat and write version-specific code (Boost-style).",
    inputSchema: {additionalProperties: false, properties: {}, type: "object"},
    name: "application_info",
  },
  {
    description:
      "List Mongo collections with indexes and counts, plus static excerpts from `backend/src/models/*.ts`. Uses `MONGO_URI` from `backend/.env` or environment.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        collectionFilter: {description: "Substring filter for collection names", type: "string"},
        summary: {description: "When true, omit long model file excerpts", type: "boolean"},
      },
      type: "object",
    },
    name: "database_schema",
  },
  {
    description:
      "Read-only Mongo: find, aggregate (no $out/$merge/$function), countDocuments, distinct. Result cap default 50, max 200.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        collection: {type: "string"},
        field: {type: "string"},
        filter: {additionalProperties: true, type: "object"},
        limit: {type: "number"},
        operation: {
          enum: ["find", "aggregate", "countDocuments", "distinct"],
          type: "string",
        },
        pipeline: {
          items: {additionalProperties: true, type: "object"},
          type: "array",
        },
      },
      required: ["collection", "operation"],
      type: "object",
    },
    name: "database_query",
  },
  {
    description:
      "Merged log tail from `.terreno/logs/app.log` (backend JSONL), `.terreno/logs/browser.log`, Metro `/events`, and Hermes console via CDP when Metro is reachable.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        entries: {type: "number"},
        level: {type: "string"},
        since: {
          description:
            "ISO-8601 timestamp; omit entries strictly before this instant when timestamps exist.",
          type: "string",
        },
        sources: {items: {type: "string"}, type: "array"},
      },
      type: "object",
    },
    name: "read_logs",
  },
  {
    description: "Most recent error-level JSONL line from backend/browser dev logs.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        sources: {items: {type: "string"}, type: "array"},
      },
      type: "object",
    },
    name: "last_error",
  },
  {
    description:
      "Inspect Redux store (auth + RTK Query cache summary) via `registerTerrenoDevStore` / `globalThis.__TERRENO_STORE__`, or via CDP when the MCP process cannot see the app heap.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        query: {
          description:
            "When slice is rtk/terreno-rtk, filter cache rows whose endpoint name or serialized args contain this substring (case-insensitive).",
          type: "string",
        },
        slice: {type: "string"},
      },
      type: "object",
    },
    name: "get_rtk_state",
  },
  {
    description:
      "Opt-in Hermes Runtime.evaluate over Metro CDP (gated by TERRENO_MCP_EVAL=1). Hermes allows a single debugger connection.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        code: {type: "string"},
      },
      required: ["code"],
      type: "object",
    },
    name: "evaluate",
  },
  {
    description:
      "expo-router navigate/push via CDP (gated by TERRENO_MCP_EVAL=1). Same Hermes connection as evaluate/logs.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        path: {type: "string"},
      },
      required: ["path"],
      type: "object",
    },
    name: "navigate",
  },
];

export const handleLocalToolCall = async (
  name: string,
  args: Record<string, unknown>
): Promise<{content: Array<{type: "text"; text: string}>}> => {
  switch (name) {
    case "application_info": {
      return {content: [{text: applicationInfo(), type: "text"}]};
    }
    case "database_schema": {
      const text = await databaseSchema({
        collectionFilter:
          typeof args.collectionFilter === "string" ? args.collectionFilter : undefined,
        summary: typeof args.summary === "boolean" ? args.summary : undefined,
      });
      return {content: [{text, type: "text"}]};
    }
    case "database_query": {
      const text = await databaseQuery({
        collection: typeof args.collection === "string" ? args.collection : "",
        field: typeof args.field === "string" ? args.field : undefined,
        filter:
          typeof args.filter === "object" && args.filter !== null
            ? (args.filter as Record<string, unknown>)
            : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
        operation: typeof args.operation === "string" ? args.operation : "",
        pipeline: Array.isArray(args.pipeline) ? (args.pipeline as unknown[]) : undefined,
      });
      return {content: [{text, type: "text"}]};
    }
    case "read_logs": {
      const text = await readLogs({
        entries: typeof args.entries === "number" ? args.entries : undefined,
        level: typeof args.level === "string" ? args.level : undefined,
        since: typeof args.since === "string" ? args.since : undefined,
        sources: Array.isArray(args.sources)
          ? args.sources.filter((s): s is string => typeof s === "string")
          : undefined,
      });
      return {content: [{text, type: "text"}]};
    }
    case "last_error": {
      const text = await lastError({
        sources: Array.isArray(args.sources)
          ? args.sources.filter((s): s is string => typeof s === "string")
          : undefined,
      });
      return {content: [{text, type: "text"}]};
    }
    case "get_rtk_state": {
      const text = await getRtkState({
        query: typeof args.query === "string" ? args.query : undefined,
        slice: typeof args.slice === "string" ? args.slice : undefined,
      });
      return {content: [{text, type: "text"}]};
    }
    case "evaluate": {
      const text = await evaluate({code: typeof args.code === "string" ? args.code : ""});
      return {content: [{text, type: "text"}]};
    }
    case "navigate": {
      const text = await navigate({path: typeof args.path === "string" ? args.path : ""});
      return {content: [{text, type: "text"}]};
    }
    default: {
      return {content: [{text: `Unknown tool: ${name}`, type: "text"}]};
    }
  }
};
