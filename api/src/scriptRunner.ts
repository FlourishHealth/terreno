import {DateTime} from "luxon";
import mongoose, {type Document, type Model, Schema} from "mongoose";

import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "./plugins";

// --- Script Runner Types & BackgroundTask Model ---

export interface ScriptResult {
  success: boolean;
  results: string[];
}

export interface ScriptContext {
  /** Check if the task has been cancelled. Throws TaskCancelledError if so. */
  checkCancellation: () => Promise<void>;
  /** Add a log entry to the task. */
  addLog: (level: "info" | "warn" | "error", message: string) => Promise<void>;
  /** Update progress on the task. */
  updateProgress: (percentage: number, stage?: string, message?: string) => Promise<void>;
}

export type ScriptRunner = (wetRun: boolean, ctx?: ScriptContext) => Promise<ScriptResult>;

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

export type BackgroundTaskMethods = {
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
};

export type BackgroundTaskDocument = Document &
  BackgroundTaskMethods & {
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
  };

export type BackgroundTaskStatics = {
  checkCancellation: (taskId: string) => Promise<void>;
};

export type BackgroundTaskModel = Model<
  BackgroundTaskDocument,
  Record<string, never>,
  BackgroundTaskMethods
> &
  BackgroundTaskStatics;

const progressSchema = new Schema(
  {
    message: {description: "Human-readable progress message", type: String},
    percentage: {description: "Progress percentage from 0 to 100", max: 100, min: 0, type: Number},
    stage: {description: "Current stage of the task", type: String},
  },
  {_id: false}
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
  {_id: false}
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
