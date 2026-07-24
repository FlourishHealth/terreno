import {DateTime} from "luxon";
import mongoose, {type Document, type Model, Schema} from "mongoose";

import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "./plugins";

// --- Script Runner Types & BackgroundTask Model ---

export interface ScriptResult {
  success: boolean;
  results: string[];
}

// --- Flexible Script Arguments ---

/** A single parsed argument value. Repeated flags collapse into a string array. */
export type ScriptArgValue = string | number | boolean | string[];

/**
 * Optional declaration for a single script argument. Declarations are purely
 * advisory: they drive validation, type coercion, default values, and help text
 * but a script can still read any argument the caller supplied. This keeps
 * argument handling flexible — declare the args you care about, ignore the rest.
 */
export interface ScriptArgDef {
  /** Canonical name (used as `--name` on the CLI and as the key in the args map). */
  name: string;
  /** Human-readable description shown in CLI help and the admin UI. */
  description: string;
  /** Type used for coercion and validation. Defaults to "string". */
  type?: "string" | "number" | "boolean";
  /** When true, parsing fails if the argument is missing. */
  required?: boolean;
  /** Default applied when the argument is not provided. */
  default?: ScriptArgValue;
  /** Alternate names accepted on the CLI (e.g. ["l"] enables `-l`). */
  aliases?: string[];
  /** Example value shown in help text. */
  example?: string;
}

/**
 * Typed, ergonomic accessor over the parsed arguments passed to a script. Scripts
 * read values via the typed getters; `raw` and `positional` expose everything for
 * advanced cases.
 */
export interface ScriptArgs {
  /** All named values keyed by canonical name. */
  raw: Record<string, ScriptArgValue>;
  /** Positional (non-flag) arguments, in order. */
  positional: string[];
  /** Whether a named argument was supplied (or has a default). */
  has: (name: string) => boolean;
  /** Read a string value (coerces numbers/booleans; first element of arrays). */
  getString: (name: string, fallback?: string) => string | undefined;
  /** Read a numeric value (coerces strings; returns fallback when missing/NaN). */
  getNumber: (name: string, fallback?: number) => number | undefined;
  /** Read a boolean value ("true"/"1"/"yes"/"on" are truthy). */
  getBoolean: (name: string, fallback?: boolean) => boolean;
  /** Read a string array (single values become a one-element array). */
  getStringArray: (name: string) => string[];
}

export interface ScriptContext {
  /** Check if the task has been cancelled. Throws TaskCancelledError if so. */
  checkCancellation: () => Promise<void>;
  /** Add a log entry to the task. */
  addLog: (level: "info" | "warn" | "error", message: string) => Promise<void>;
  /** Update progress on the task. */
  updateProgress: (percentage: number, stage?: string, message?: string) => Promise<void>;
  /** Arguments supplied to this run (from the CLI, HTTP body, or admin UI). */
  args: ScriptArgs;
}

export type ScriptRunner = (wetRun: boolean, ctx?: ScriptContext) => Promise<ScriptResult>;

const coerceArgValue = (
  value: ScriptArgValue,
  type: ScriptArgDef["type"]
): {value: ScriptArgValue; error?: string} => {
  if (type === "number") {
    const num = typeof value === "number" ? value : Number(Array.isArray(value) ? value[0] : value);
    if (Number.isNaN(num)) {
      return {error: `expected a number but received "${String(value)}"`, value};
    }
    return {value: num};
  }
  if (type === "boolean") {
    if (typeof value === "boolean") {
      return {value};
    }
    const normalized = String(Array.isArray(value) ? value[0] : value).toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return {value: true};
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return {value: false};
    }
    return {error: `expected a boolean but received "${String(value)}"`, value};
  }
  return {value};
};

const toStringValue = (value: ScriptArgValue | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return String(value);
};

/**
 * Build a {@link ScriptArgs} accessor from a raw values map and optional declarations.
 * Applies declared defaults, coerces declared types, and validates required args.
 * Returns the accessor plus any validation errors (callers decide how to surface them).
 */
export const createScriptArgs = ({
  values,
  positional = [],
  defs = [],
}: {
  values: Record<string, ScriptArgValue>;
  positional?: string[];
  defs?: ScriptArgDef[];
}): {args: ScriptArgs; errors: string[]} => {
  const errors: string[] = [];
  const raw: Record<string, ScriptArgValue> = {...values};

  for (const def of defs) {
    if (raw[def.name] === undefined) {
      if (def.default !== undefined) {
        raw[def.name] = def.default;
      } else if (def.required) {
        errors.push(`Missing required argument: --${def.name} (${def.description})`);
      }
      continue;
    }
    const coerced = coerceArgValue(raw[def.name], def.type);
    if (coerced.error) {
      errors.push(`Invalid argument --${def.name}: ${coerced.error}`);
      continue;
    }
    raw[def.name] = coerced.value;
  }

  const args: ScriptArgs = {
    getBoolean: (name, fallback = false) => {
      const value = raw[name];
      if (value === undefined) {
        return fallback;
      }
      if (typeof value === "boolean") {
        return value;
      }
      const normalized = toStringValue(value)?.toLowerCase();
      return normalized !== undefined && ["true", "1", "yes", "on"].includes(normalized);
    },
    getNumber: (name, fallback) => {
      const value = raw[name];
      if (value === undefined) {
        return fallback;
      }
      const num = typeof value === "number" ? value : Number(toStringValue(value));
      return Number.isNaN(num) ? fallback : num;
    },
    getString: (name, fallback) => toStringValue(raw[name]) ?? fallback,
    getStringArray: (name) => {
      const value = raw[name];
      if (value === undefined) {
        return [];
      }
      if (Array.isArray(value)) {
        return value;
      }
      return [String(value)];
    },
    has: (name) => raw[name] !== undefined,
    positional,
    raw,
  };

  return {args, errors};
};

/**
 * Parse CLI-style tokens into a {@link ScriptArgs} accessor. Supports a flexible set
 * of conventions so callers and scripts do not need to agree on a rigid format:
 *
 * - `--name=value` and `--name value`
 * - `--flag` (boolean true) and `--no-flag` (boolean false)
 * - short aliases `-x` (treated like `--x`)
 * - repeated flags collapse into a string array
 * - bare tokens become positional arguments
 *
 * When {@link ScriptArgDef declarations} are supplied, values are coerced to the
 * declared type, defaults are applied, and required args are validated.
 */
export const parseScriptArgs = (
  tokens: string[],
  defs: ScriptArgDef[] = []
): {args: ScriptArgs; errors: string[]} => {
  const aliasToName = new Map<string, string>();
  const defByName = new Map<string, ScriptArgDef>();
  for (const def of defs) {
    defByName.set(def.name, def);
    for (const alias of def.aliases ?? []) {
      aliasToName.set(alias, def.name);
    }
  }

  const values: Record<string, ScriptArgValue> = {};
  const positional: string[] = [];
  const missingValueErrors: string[] = [];

  const assign = (key: string, value: ScriptArgValue): void => {
    const name = aliasToName.get(key) ?? key;
    const existing = values[name];
    if (existing === undefined) {
      values[name] = value;
      return;
    }
    // Repeated flag: collapse into an array of strings.
    const asArray = Array.isArray(existing) ? existing : [String(existing)];
    values[name] = [...asArray, String(value)];
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("-") || token === "-") {
      positional.push(token);
      continue;
    }

    const flag = token.replace(/^-+/, "");
    if (flag.startsWith("no-") && !flag.includes("=")) {
      assign(flag.slice(3), false);
      continue;
    }

    const eqIndex = flag.indexOf("=");
    if (eqIndex !== -1) {
      assign(flag.slice(0, eqIndex), flag.slice(eqIndex + 1));
      continue;
    }

    const canonical = aliasToName.get(flag) ?? flag;
    const def = defByName.get(canonical);
    const next = tokens[i + 1];
    const nextIsValue = next !== undefined && (next === "-" || !next.startsWith("-"));
    if (def?.type === "boolean") {
      assign(flag, true);
      continue;
    }
    if (!nextIsValue) {
      // A declared string/number flag was given without a value. Record an error
      // instead of silently storing `true` (which would coerce to 1 / "true").
      if (def) {
        missingValueErrors.push(`Argument --${canonical} expects a ${def.type ?? "string"} value`);
        continue;
      }
      assign(flag, true);
      continue;
    }
    assign(flag, next);
    i++;
  }

  const {args, errors} = createScriptArgs({defs, positional, values});
  return {args, errors: [...missingValueErrors, ...errors]};
};

export class TaskCancelledError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} was cancelled`);
    this.name = "TaskCancelledError";
  }
}

// --- BackgroundTask Model ---

interface BackgroundTaskProgress {
  percentage: number;
  stage?: string;
  message?: string;
}

interface BackgroundTaskLog {
  timestamp: Date;
  level: "info" | "warn" | "error";
  message: string;
}

export interface BackgroundTaskMethods {
  addLog: (
    this: BackgroundTaskDocument,
    level: "info" | "warn" | "error",
    message: string
  ) => Promise<void>;
  updateProgress: (
    this: BackgroundTaskDocument,
    percentage: number,
    stage?: string,
    message?: string
  ) => Promise<void>;
}

export interface BackgroundTaskDocument extends Document, BackgroundTaskMethods {
  taskType: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress?: BackgroundTaskProgress;
  createdBy?: mongoose.Types.ObjectId;
  isDryRun: boolean;
  result?: string[];
  error?: string;
  logs: BackgroundTaskLog[];
  startedAt?: Date;
  completedAt?: Date;
  created: Date;
  updated: Date;
  deleted: boolean;
}

export interface BackgroundTaskStatics {
  checkCancellation: (taskId: string) => Promise<void>;
}

export interface BackgroundTaskModel
  extends Model<BackgroundTaskDocument, Record<string, never>, BackgroundTaskMethods>,
    BackgroundTaskStatics {}

const progressSchema = new Schema(
  {
    message: {description: "Human-readable progress message", type: String},
    percentage: {description: "Progress percentage from 0 to 100", max: 100, min: 0, type: Number},
    stage: {description: "Current stage of the task", type: String},
  },
  {_id: false, strict: "throw"}
);

const logSchema = new Schema(
  {
    level: {
      description: "Log level",
      enum: ["info", "warn", "error"],
      required: true,
      type: String,
    },
    message: {description: "Log message", required: true, type: String},
    timestamp: {description: "When this log entry was created", required: true, type: Date},
  },
  {_id: false, strict: "throw"}
);

const backgroundTaskSchema = new Schema<
  BackgroundTaskDocument,
  BackgroundTaskModel,
  BackgroundTaskMethods
>(
  {
    completedAt: {
      description: "When the task completed (success or failure)",
      type: Date,
    },
    createdBy: {
      description: "The user who created this task",
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
    error: {
      description: "Error message if the task failed",
      type: String,
    },
    isDryRun: {
      default: false,
      description: "Whether this is a dry run that does not make real changes",
      type: Boolean,
    },
    logs: {
      default: [],
      description: "Log entries for the task execution",
      type: [logSchema],
    },
    progress: {
      description: "Progress information for the task",
      type: progressSchema,
    },
    result: {
      description: "Result strings when the task completes",
      type: [String],
    },
    startedAt: {
      description: "When the task started executing",
      type: Date,
    },
    status: {
      default: "pending",
      description: "Current status of the task",
      enum: ["pending", "running", "completed", "failed", "cancelled"],
      type: String,
    },
    taskType: {
      description: "The type or name of the background task",
      required: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

backgroundTaskSchema.methods = {
  async addLog(
    this: BackgroundTaskDocument,
    level: "info" | "warn" | "error",
    message: string
  ): Promise<void> {
    if (!this.logs) {
      this.logs = [];
    }
    this.logs.push({
      level,
      message,
      timestamp: DateTime.now().toJSDate(),
    });
    await this.save();
  },

  async updateProgress(
    this: BackgroundTaskDocument,
    percentage: number,
    stage?: string,
    message?: string
  ): Promise<void> {
    this.progress = {
      message: message ?? this.progress?.message,
      percentage,
      stage: stage ?? this.progress?.stage,
    };
    await this.save();
  },
};

backgroundTaskSchema.statics = {
  async checkCancellation(this: BackgroundTaskModel, taskId: string): Promise<void> {
    const task = await this.findById(taskId).select("status").lean();
    if (task?.status === "cancelled") {
      throw new TaskCancelledError(taskId);
    }
  },
};

backgroundTaskSchema.index({createdBy: 1, status: 1});
backgroundTaskSchema.index({status: 1});
backgroundTaskSchema.index({status: 1, taskType: 1});

backgroundTaskSchema.plugin(createdUpdatedPlugin);
backgroundTaskSchema.plugin(isDeletedPlugin);
backgroundTaskSchema.plugin(findOneOrNone);
backgroundTaskSchema.plugin(findExactlyOne);

export const BackgroundTask = mongoose.model<BackgroundTaskDocument, BackgroundTaskModel>(
  "BackgroundTask",
  backgroundTaskSchema
);
