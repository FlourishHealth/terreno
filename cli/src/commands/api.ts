import {readFile} from "node:fs/promises";
import {isAbsolute, join} from "node:path";

import type {CliIo} from "../io";
import {printJson} from "../io";
import {flagList, flagString, type ParsedArgs} from "../parseArgs";
import {parseHeaderFlags, parseJsonValue, parseNameValuePairs} from "../rest/flagValues";
import {invokeRestOperation} from "../rest/invoke";
import {defaultBaseUrl, loadOpenApiDocument} from "../rest/loadSpec";
import {findRestOperation, listRestOperations} from "../rest/operations";

const resolveFromCwd = (cwd: string, value: string): string => {
  if (/^https?:\/\//i.test(value) || isAbsolute(value)) {
    return value;
  }
  return join(cwd, value);
};

const requireSchema = (parsed: ParsedArgs, io: CliIo): string | undefined => {
  return flagString(parsed.flags, "schema") ?? io.env.TERRENO_OPENAPI;
};

export const runApiCommand = async (
  parsed: ParsedArgs,
  io: CliIo,
  json: boolean
): Promise<number> => {
  const action = parsed.positionals[1];
  const schema = requireSchema(parsed, io);
  if (!schema) {
    io.stderr("Pass --schema <openapi.json|yaml|url> or set TERRENO_OPENAPI");
    return 1;
  }
  const spec = await loadOpenApiDocument(resolveFromCwd(io.cwd, schema), io.fetch);
  const operations = listRestOperations(spec);
  const baseUrl =
    flagString(parsed.flags, "base-url") ?? io.env.TERRENO_API_URL ?? defaultBaseUrl(spec);
  const token = flagString(parsed.flags, "token") ?? io.env.TERRENO_TOKEN;
  const params = parseNameValuePairs(flagList(parsed.flags, "param"));
  const headers = parseHeaderFlags(flagList(parsed.flags, "header"));
  const bodyRaw = flagString(parsed.flags, "body");
  const bodyFile = flagString(parsed.flags, "body-file");
  let body: unknown;
  if (bodyFile) {
    body = parseJsonValue(await readFile(resolveFromCwd(io.cwd, bodyFile), "utf8"));
  } else if (bodyRaw) {
    body = parseJsonValue(bodyRaw);
  }

  if (action === "list") {
    const rows = operations.map((op) => ({
      id: op.id,
      method: op.method.toUpperCase(),
      path: op.path,
      summary: op.summary ?? "",
    }));
    if (json) {
      printJson(io, rows);
    } else {
      for (const row of rows) {
        io.stdout(`${row.id.padEnd(28)} ${row.method.padEnd(7)} ${row.path}  ${row.summary}`);
      }
    }
    return 0;
  }

  if (action === "call") {
    const id = parsed.positionals[2];
    if (!id) {
      io.stderr("Usage: terreno api call <operationId>");
      return 1;
    }
    const operation = findRestOperation(operations, {id});
    if (!operation) {
      io.stderr(`Unknown operation "${id}"`);
      return 1;
    }
    const result = await invokeRestOperation({
      baseUrl,
      body,
      fetch: io.fetch,
      headers,
      operation,
      params,
      token,
    });
    if (json) {
      printJson(io, result.parsed ?? {status: result.status});
    } else {
      io.stdout(`HTTP ${String(result.status)} ${result.url}`);
      io.stdout(
        typeof result.parsed === "string" ? result.parsed : JSON.stringify(result.parsed, null, 2)
      );
    }
    return result.ok ? 0 : 1;
  }

  if (action === "request") {
    const method = parsed.positionals[2];
    const path = parsed.positionals[3];
    if (!method || !path) {
      io.stderr("Usage: terreno api request <METHOD> <path>");
      return 1;
    }
    const operation = findRestOperation(operations, {method, path});
    if (!operation) {
      io.stderr(`No operation for ${method.toUpperCase()} ${path}`);
      return 1;
    }
    const result = await invokeRestOperation({
      baseUrl,
      body,
      fetch: io.fetch,
      headers,
      operation,
      params,
      token,
    });
    if (json) {
      printJson(io, result.parsed ?? {status: result.status});
    } else {
      io.stdout(`HTTP ${String(result.status)} ${result.url}`);
      io.stdout(
        typeof result.parsed === "string" ? result.parsed : JSON.stringify(result.parsed, null, 2)
      );
    }
    return result.ok ? 0 : 1;
  }

  io.stderr("Usage: terreno api <list|call|request>");
  return 1;
};
