import {handleLocalToolCall} from "@terreno/mcp/local-tools";

import type {CliIo} from "../io";
import {printJson} from "../io";
import {flagBoolean, flagList, flagString, type ParsedArgs} from "../parseArgs";
import {parseJsonValue} from "../rest/flagValues";

const printToolResult = (
  io: CliIo,
  json: boolean,
  result: {content: Array<{text: string; type: string}>}
): number => {
  const text = result.content.map((part) => part.text).join("\n");
  if (json) {
    try {
      printJson(io, JSON.parse(text) as unknown);
    } catch {
      printJson(io, {ok: true, result: text});
    }
  } else {
    io.stdout(text);
  }
  return 0;
};

export const runInfoCommand = async (io: CliIo, json: boolean): Promise<number> => {
  const result = await handleLocalToolCall("application_info", {});
  return printToolResult(io, json, result);
};

export const runLogsCommand = async (
  parsed: ParsedArgs,
  io: CliIo,
  json: boolean
): Promise<number> => {
  const action = parsed.positionals[1];
  if (action === "last-error") {
    const result = await handleLocalToolCall("last_error", {
      sources: flagList(parsed.flags, "source", "sources"),
    });
    return printToolResult(io, json, result);
  }
  if (action && action !== "tail") {
    io.stderr("Usage: terreno logs [last-error]");
    return 1;
  }
  const entriesRaw = flagString(parsed.flags, "entries");
  const result = await handleLocalToolCall("read_logs", {
    entries: entriesRaw ? Number(entriesRaw) : undefined,
    level: flagString(parsed.flags, "level"),
    sources: flagList(parsed.flags, "source", "sources"),
  });
  return printToolResult(io, json, result);
};

export const runDbCommand = async (
  parsed: ParsedArgs,
  io: CliIo,
  json: boolean
): Promise<number> => {
  const action = parsed.positionals[1];
  if (action === "schema") {
    const result = await handleLocalToolCall("database_schema", {
      collectionFilter: flagString(parsed.flags, "collection-filter"),
      summary: flagBoolean(parsed.flags, "summary"),
    });
    return printToolResult(io, json, result);
  }
  if (action === "query") {
    const collection = flagString(parsed.flags, "collection");
    if (!collection) {
      io.stderr("Usage: terreno db query --collection <name> --operation find");
      return 1;
    }
    const filterRaw = flagString(parsed.flags, "filter");
    const pipelineRaw = flagString(parsed.flags, "pipeline");
    const limitRaw = flagString(parsed.flags, "limit");
    const result = await handleLocalToolCall("database_query", {
      collection,
      field: flagString(parsed.flags, "field"),
      filter: filterRaw ? parseJsonValue(filterRaw) : undefined,
      limit: limitRaw ? Number(limitRaw) : undefined,
      operation: flagString(parsed.flags, "operation") ?? "find",
      pipeline: pipelineRaw ? parseJsonValue(pipelineRaw) : undefined,
    });
    return printToolResult(io, json, result);
  }
  io.stderr("Usage: terreno db <schema|query>");
  return 1;
};
