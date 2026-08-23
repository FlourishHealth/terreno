import {flagBoolean, flagList, flagString, parseArgs} from "../parseArgs";
import {parseHeaderFlags, parseJsonValue, parseNameValuePairs} from "./flagValues";
import {invokeRestOperation} from "./invoke";
import {defaultBaseUrl, parseOpenApiDocument} from "./loadSpec";
import {findRestOperation, listRestOperations} from "./operations";

export interface RunAppRestCliOptions {
  argv: string[];
  binName: string;
  defaultBaseUrl?: string;
  specText: string;
  title: string;
}

const helpFor = (binName: string, title: string): string => {
  return `Usage: ${binName} <list|call|request> [options]

OpenAPI CLI for ${title}

  list
  call <operationId> [--param name=value] [--body json]
  request <METHOD> <path> [--param name=value] [--body json]

Options:
  --base-url <url>
  --token <token>
  --header "Name: value"
  --json
`;
};

const printResult = (
  json: boolean,
  result: {ok: boolean; parsed: unknown; status: number; url: string}
): number => {
  if (json) {
    console.info(
      JSON.stringify({body: result.parsed, status: result.status, url: result.url}, null, 2)
    );
  } else {
    console.info(`HTTP ${result.status} ${result.url}`);
    console.info(
      typeof result.parsed === "string" ? result.parsed : JSON.stringify(result.parsed, null, 2)
    );
  }
  return result.ok ? 0 : 1;
};

export const runAppRestCli = async (options: RunAppRestCliOptions): Promise<number> => {
  const parsed = parseArgs(options.argv);
  const wantsHelp = flagBoolean(parsed.flags, "help", "h");
  if (wantsHelp || parsed.positionals.length === 0) {
    console.info(helpFor(options.binName, options.title));
    return wantsHelp ? 0 : 1;
  }

  const spec = parseOpenApiDocument(options.specText);
  const operations = listRestOperations(spec);
  const command = parsed.positionals[0];
  const json = flagBoolean(parsed.flags, "json");
  const baseUrl =
    flagString(parsed.flags, "base-url") ??
    process.env.TERRENO_API_URL ??
    options.defaultBaseUrl ??
    defaultBaseUrl(spec);
  const token = flagString(parsed.flags, "token") ?? process.env.TERRENO_TOKEN;
  const params = parseNameValuePairs(flagList(parsed.flags, "param"));
  const headers = parseHeaderFlags(flagList(parsed.flags, "header"));
  const body = parseJsonValue(flagString(parsed.flags, "body"));

  if (command === "list") {
    const rows = operations.map((op) => ({
      id: op.id,
      method: op.method.toUpperCase(),
      path: op.path,
      summary: op.summary ?? "",
    }));
    if (json) {
      console.info(JSON.stringify(rows, null, 2));
    } else {
      for (const row of rows) {
        console.info(`${row.id.padEnd(28)} ${row.method.padEnd(7)} ${row.path}  ${row.summary}`);
      }
    }
    return 0;
  }

  if (command === "call") {
    const id = parsed.positionals[1];
    if (!id) {
      console.error("Missing operationId");
      return 1;
    }
    const operation = findRestOperation(operations, {id});
    if (!operation) {
      console.error(`Unknown operation "${id}"`);
      return 1;
    }
    const result = await invokeRestOperation({
      baseUrl,
      body,
      fetch: globalThis.fetch.bind(globalThis),
      headers,
      operation,
      params,
      token,
    });
    return printResult(json, result);
  }

  if (command === "request") {
    const method = parsed.positionals[1];
    const path = parsed.positionals[2];
    if (!method || !path) {
      console.error("Usage: request <METHOD> <path>");
      return 1;
    }
    const operation = findRestOperation(operations, {method, path});
    if (!operation) {
      console.error(`No operation for ${method.toUpperCase()} ${path}`);
      return 1;
    }
    const result = await invokeRestOperation({
      baseUrl,
      body,
      fetch: globalThis.fetch.bind(globalThis),
      headers,
      operation,
      params,
      token,
    });
    return printResult(json, result);
  }

  console.error(`Unknown command "${command}"`);
  return 1;
};
