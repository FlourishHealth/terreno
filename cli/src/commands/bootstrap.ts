import {isAbsolute, join} from "node:path";
import {generateAiRulesFiles, generateAllFiles} from "@terreno/mcp/bootstrap";

import type {CliIo} from "../io";
import {printJson} from "../io";
import {flagString, type ParsedArgs} from "../parseArgs";
import {writeFiles} from "../writeFiles";

const resolveFromCwd = (cwd: string, value: string): string => {
  if (isAbsolute(value)) {
    return value;
  }
  return join(cwd, value);
};

const parsePackages = (raw: string | undefined): string[] | undefined => {
  if (!raw) {
    return undefined;
  }
  const packages = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return packages.length > 0 ? packages : undefined;
};

export const runBootstrapCommand = async (
  parsed: ParsedArgs,
  io: CliIo,
  json: boolean
): Promise<number> => {
  const action = parsed.positionals[1];
  const name = flagString(parsed.flags, "name");
  const displayName = flagString(parsed.flags, "display-name") ?? name;
  const dest = flagString(parsed.flags, "dir") ?? io.cwd;
  if (!name || !displayName) {
    io.stderr("Usage: terreno bootstrap <app|rules> --name <kebab> --display-name <title>");
    return 1;
  }
  const root = resolveFromCwd(io.cwd, dest);

  if (action === "app") {
    const files = generateAllFiles({
      appDisplayName: displayName,
      appName: name,
      description: flagString(parsed.flags, "description"),
      mcpServerUrl: flagString(parsed.flags, "mcp-url"),
    });
    await writeFiles(root, files);
    if (json) {
      printJson(io, {files: files.map((file) => file.path), ok: true, path: root});
    } else {
      io.stdout(`Wrote ${String(files.length)} files to ${root}`);
    }
    return 0;
  }

  if (action === "rules") {
    const files = generateAiRulesFiles({
      appDisplayName: displayName,
      appName: name,
      packages: parsePackages(flagString(parsed.flags, "packages")),
    });
    await writeFiles(root, files);
    if (json) {
      printJson(io, {files: files.map((file) => file.path), ok: true, path: root});
    } else {
      io.stdout(`Wrote ${String(files.length)} files to ${root}`);
    }
    return 0;
  }

  io.stderr("Usage: terreno bootstrap <app|rules>");
  return 1;
};
