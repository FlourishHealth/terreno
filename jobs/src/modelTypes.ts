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

export const IN_FLIGHT_JOB_STATUSES: readonly JobStatus[] = ["pending", "running", "scheduled"];

export interface JobAttempt {
  at: Date;
  error?: string;
  errorClass?: string;
}

export type JobMethods = Record<never, never>;

export interface JobDocument extends mongoose.Document<mongoose.Types.ObjectId>, JobMethods {
  attemptCount: number;
  attempts: JobAttempt[];
  backoffMs: number;
  created: Date;
  idempotencyKey?: string;
  lastError?: string;
  lockedAt?: Date;
  lockedBy?: string;
  maxAttempts: number;
  maxBackoffMs: number;
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

export type JobScheduleMethods = Record<never, never>;

export interface JobScheduleDocument
  extends mongoose.Document<mongoose.Types.ObjectId>,
    JobScheduleMethods {
  created: Date;
  cron: string;
  enabled: boolean;
  handlerName: string;
  name: string;
  nextRunAt: Date;
  timezone: string;
  updated: Date;
}

export interface JobScheduleStatics
  extends FindExactlyOnePlugin<JobScheduleDocument>,
    FindOneOrNonePlugin<JobScheduleDocument> {}

export interface JobScheduleModel extends mongoose.Model<JobScheduleDocument>, JobScheduleStatics {}

export type JobScheduleSchema = mongoose.Schema<
  JobScheduleDocument,
  JobScheduleModel,
  JobScheduleMethods
>;
