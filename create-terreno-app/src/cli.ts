#!/usr/bin/env node

import {pathToFileURL} from "node:url";

import {parseCliArgs, writeScaffold} from "./writeScaffold.js";

export interface RunCliOptions {
  argv?: string[];
  cwd?: string;
  /** When true (default), exits the process with the result code. */
  exit?: boolean;
  write?: (line: string) => void;
  writeError?: (line: string) => void;
}

export interface RunCliResult {
  exitCode: number;
  nextSteps: string[];
  success: boolean;
  targetPath?: string;
  error?: string;
}

export const runCli = (options: RunCliOptions = {}): RunCliResult => {
  const argv = options.argv ?? process.argv.slice(2);
  const write =
    options.write ??
    ((line: string): void => {
      process.stdout.write(`${line}\n`);
    });
  const writeError =
    options.writeError ??
    ((line: string): void => {
      process.stderr.write(`${line}\n`);
    });
  const shouldExit = options.exit !== false;
  const cwd = options.cwd ?? process.cwd();

  const parsed = parseCliArgs(argv);
  if (parsed.errors.length > 0) {
    for (const error of parsed.errors) {
      writeError(error);
    }
    const result: RunCliResult = {
      error: parsed.errors.join("; "),
      exitCode: 1,
      nextSteps: [],
      success: false,
    };
    if (shouldExit) {
      process.exit(result.exitCode);
    }
    return result;
  }

  if (!parsed.appName || !parsed.displayName) {
    const result: RunCliResult = {
      error: "Missing appName or display name",
      exitCode: 1,
      nextSteps: [],
      success: false,
    };
    if (shouldExit) {
      process.exit(result.exitCode);
    }
    return result;
  }

  const scaffoldResult = writeScaffold({
    appDisplayName: parsed.displayName,
    appName: parsed.appName,
    description: parsed.description,
    mcpServerUrl: parsed.mcpServerUrl,
    parentDir: cwd,
  });

  if (!scaffoldResult.success) {
    if (scaffoldResult.error) {
      writeError(scaffoldResult.error);
    }
    const result: RunCliResult = {
      error: scaffoldResult.error,
      exitCode: scaffoldResult.exitCode,
      nextSteps: [],
      success: false,
      targetPath: scaffoldResult.targetPath,
    };
    if (shouldExit) {
      process.exit(result.exitCode);
    }
    return result;
  }

  write(`Created ${scaffoldResult.targetPath}`);
  write("");
  write("Next steps:");
  for (const step of scaffoldResult.nextSteps) {
    write(step);
  }

  const result: RunCliResult = {
    exitCode: 0,
    nextSteps: scaffoldResult.nextSteps,
    success: true,
    targetPath: scaffoldResult.targetPath,
  };
  if (shouldExit) {
    process.exit(result.exitCode);
  }
  return result;
};

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  runCli();
}
