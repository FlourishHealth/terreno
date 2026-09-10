import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";

export type JobStatus =
  | "cancelled"
  | "completed"
  | "dead"
  | "failed"
  | "pending"
  | "running"
  | "scheduled";

export interface JobAttempt {
  at: Date;
  error?: string;
  errorClass?: string;
}

export type JobMethods = Record<never, never>;

export interface JobDocument extends mongoose.Document<mongoose.Types.ObjectId>, JobMethods {
  attemptCount: number;
  attempts: JobAttempt[];
  created: Date;
  idempotencyKey?: string;
  lastError?: string;
  lockedAt?: Date;
  lockedBy?: string;
  maxAttempts: number;
  name: string;
  payload?: unknown;
  payloadRedacted: boolean;
  retriedById?: mongoose.Types.ObjectId;
  retriedFromId?: mongoose.Types.ObjectId;
  runAt: Date;
  scheduleId?: mongoose.Types.ObjectId;
  status: JobStatus;
  updated: Date;
}

export interface JobStatics
  extends FindExactlyOnePlugin<JobDocument>,
    FindOneOrNonePlugin<JobDocument> {}

export interface JobModel extends mongoose.Model<JobDocument>, JobStatics {}

export type JobSchema = mongoose.Schema<JobDocument, JobModel, JobMethods>;
