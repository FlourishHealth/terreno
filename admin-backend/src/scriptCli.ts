import {
  logger,
  parseScriptArgs,
  type ScriptArgDef,
  type ScriptContext,
  type ScriptResult,
} from "@terreno/api";

import type {AdminScriptConfig} from "./adminApp";

/**
 * Flag names reserved by the script runner itself. They control how a script is
 * invoked (CLI flags and the HTTP `wetRun` query) and are stripped from the
 * arguments handed to the script runner, so script authors should avoid declaring
 * args with these names. Exported so the admin HTTP route can strip the same set
 * and keep `ctx.args` identical across CLI and HTTP invocations.
 */
export const RESERVED_SCRIPT_FLAGS = ["help", "h", "list", "json", "wet", "wetRun", "dry"];

export interface RunScriptCliOptions {
  /** The same script configs registered on {@link AdminApp}. */
  scripts: AdminScriptConfig[];
  /** Tokens to parse. Defaults to `process.argv.slice(2)`. */
  argv?: string[];
  /** Line writer for human-readable output. Defaults to stdout. */
  write?: (line: string) => void;
  /**
   * When true (default), the process exits with the resulting exit code after the
   * run. Pass false in tests or when embedding the runner in a larger CLI.
   */
  exit?: boolean;
  /** Program name shown in help text. Defaults to "script". */
  programName?: string;
}

export interface RunScriptCliResult {
  exitCode: number;
  script?: string;
  wetRun: boolean;
  success: boolean;
  results: string[];
  errors: string[];
}

const formatArgUsage = (arg: ScriptArgDef): string => {
  const type = arg.type ?? "string";
  const base = type === "boolean" ? `--${arg.name}` : `--${arg.name} <${type}>`;
  return arg.required ? base : `[${base}]`;
};

const describeArg = (arg: ScriptArgDef): string => {
  const parts = [`    --${arg.name}`];
  if (arg.aliases && arg.aliases.length > 0) {
    parts.push(`(-${arg.aliases.join(", -")})`);
  }
  parts.push(`[${arg.type ?? "string"}${arg.required ? ", required" : ""}]`);
  parts.push(`- ${arg.description}`);
  if (arg.default !== undefined) {
    parts.push(`(default: ${String(arg.default)})`);
  }
  if (arg.example !== undefined) {
    parts.push(`(e.g. ${arg.example})`);
  }
  return parts.join(" ");
};

const printGeneralHelp = (
  scripts: AdminScriptConfig[],
  programName: string,
  write: (line: string) => void
): void => {
  write(`Usage: ${programName} <script> [--wet] [args...]`);
  write("");
  write("Runs a registered admin script. Defaults to a dry run; pass --wet to apply changes.");
  write("");
  write("Options:");
  write("  --wet, --wetRun   Run in wet mode (applies changes). Default is a dry run.");
  write("  --dry             Force a dry run (overrides --wet).");
  write("  --json            Emit the result as a single JSON line.");
  write("  --list            List available scripts and exit.");
  write("  --help, -h        Show help. Combine with a script name for per-script help.");
  write("");
  if (scripts.length === 0) {
    write("No scripts are registered.");
    return;
  }
  write("Available scripts:");
  for (const script of scripts) {
    write(`  ${script.name}  - ${script.description}`);
  }
  write("");
  write(`Run "${programName} <script> --help" for a script's arguments.`);
};

const printScriptHelp = (
  script: AdminScriptConfig,
  programName: string,
  write: (line: string) => void
): void => {
  const args = script.args ?? [];
  const usageArgs = args.map(formatArgUsage).join(" ");
  write(`Usage: ${programName} ${script.name} [--wet] ${usageArgs}`.trimEnd());
  write("");
  write(script.description);
  if (args.length > 0) {
    write("");
    write("Arguments:");
    for (const arg of args) {
      write(describeArg(arg));
    }
  }
};

/**
 * Runs a registered admin script from the command line. Exposes every script
 * configured on {@link AdminApp} as a CLI so they can be invoked directly from the
 * project (e.g. by an AI assistant) using the same definitions and argument
 * handling as the admin HTTP routes.
 *
 * The caller is responsible for any environment setup the scripts need (typically
 * connecting to MongoDB) before calling this, and for tearing it down afterwards.
 */
export const runScriptCli = async (options: RunScriptCliOptions): Promise<RunScriptCliResult> => {
  const {scripts} = options;
  const argv = options.argv ?? process.argv.slice(2);
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const shouldExit = options.exit !== false;
  const programName = options.programName ?? "script";

  const finish = (result: RunScriptCliResult): RunScriptCliResult => {
    if (shouldExit) {
      process.exit(result.exitCode);
    }
    return result;
  };

  const wantsHelp = argv.includes("--help") || argv.includes("-h");
  const wantsList = argv.includes("--list");
  const wantsJson = argv.includes("--json");
  const scriptName = argv.find((token) => !token.startsWith("-"));

  if (wantsList || (!scriptName && !wantsHelp)) {
    printGeneralHelp(scripts, programName, write);
    return finish({errors: [], exitCode: 0, results: [], success: true, wetRun: false});
  }

  if (!scriptName) {
    printGeneralHelp(scripts, programName, write);
    return finish({errors: [], exitCode: 0, results: [], success: true, wetRun: false});
  }

  const script = scripts.find((s) => s.name === scriptName);
  if (!script) {
    const available = scripts.map((s) => s.name).join(", ") || "(none)";
    const message = `Unknown script: ${scriptName}. Available scripts: ${available}`;
    write(message);
    return finish({
      errors: [message],
      exitCode: 1,
      results: [],
      script: scriptName,
      success: false,
      wetRun: false,
    });
  }

  if (wantsHelp) {
    printScriptHelp(script, programName, write);
    return finish({
      errors: [],
      exitCode: 0,
      results: [],
      script: script.name,
      success: true,
      wetRun: false,
    });
  }

  // Everything after removing the script name is treated as arguments.
  const nameIndex = argv.indexOf(scriptName);
  const argTokens = [...argv.slice(0, nameIndex), ...argv.slice(nameIndex + 1)];

  const {args, errors} = parseScriptArgs(argTokens, script.args ?? []);

  // Reserved flags control the CLI; resolve them, then strip from the script's args.
  const dryRequested = args.getBoolean("dry");
  const wetRequested = args.getBoolean("wet") || args.getBoolean("wetRun");
  const wetRun = wetRequested && !dryRequested;
  for (const reserved of RESERVED_SCRIPT_FLAGS) {
    delete args.raw[reserved];
  }

  if (errors.length > 0) {
    for (const error of errors) {
      write(error);
    }
    write("");
    printScriptHelp(script, programName, write);
    return finish({
      errors,
      exitCode: 1,
      results: [],
      script: script.name,
      success: false,
      wetRun,
    });
  }

  const ctx: ScriptContext = {
    addLog: async (level, message) => {
      if (!wantsJson) {
        write(`[${level}] ${message}`);
      }
    },
    args,
    checkCancellation: async () => {
      // No background task to cancel against when running from the CLI.
    },
    updateProgress: async (percentage, stage, message) => {
      if (!wantsJson) {
        const suffix = [stage, message].filter(Boolean).join(" - ");
        write(`[progress] ${percentage}%${suffix ? ` ${suffix}` : ""}`);
      }
    },
  };

  if (!wantsJson) {
    write(`Running "${script.name}" (${wetRun ? "wet run" : "dry run"})...`);
  }

  try {
    const result: ScriptResult = await script.runner(wetRun, ctx);
    if (wantsJson) {
      write(
        JSON.stringify({
          results: result.results,
          script: script.name,
          success: result.success,
          wetRun,
        })
      );
    } else {
      for (const line of result.results) {
        write(line);
      }
      write(result.success ? "Done." : "Script reported failure.");
    }
    return finish({
      errors: [],
      exitCode: result.success ? 0 : 1,
      results: result.results,
      script: script.name,
      success: result.success,
      wetRun,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Script ${script.name} failed: ${message}`);
    if (wantsJson) {
      write(JSON.stringify({error: message, script: script.name, success: false, wetRun}));
    } else {
      write(`Error: ${message}`);
    }
    return finish({
      errors: [message],
      exitCode: 1,
      results: [],
      script: script.name,
      success: false,
      wetRun,
    });
  }
};
