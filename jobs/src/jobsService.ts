import {APIError, NotFoundError} from "@terreno/api";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import {abortActiveJobExecution} from "./activeJobExecution";
import {dispatchJobToRunner} from "./dispatchCompensation";
import {Job} from "./models/job";
import {JobSchedule} from "./models/jobSchedule";
import type {JobDocument, JobScheduleDocument} from "./modelTypes";
import {DEFAULT_BACKOFF_MS, DEFAULT_MAX_BACKOFF_MS} from "./retryBackoff";
import {
  computeInitialNextRunAt,
  resolveScheduleTimezone,
  validateScheduleDefinition,
} from "./scheduleCron";
import {tickDueSchedules} from "./scheduler";
import type {EnqueueJobParams, JobDefinition, JobRunner} from "./types";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TIMEZONE = "UTC";
const UNKNOWN_JOB_NAME_TITLE = "Unknown job name";

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as {code: unknown}).code === 11_000
  );

export class JobsService {
  private readonly defaultTimezone: string;
  private readonly definitions = new Map<string, JobDefinition>();
  private readonly lockTtlMs: number;
  private readonly runner: JobRunner | undefined;
  private schedulesDirty = false;

  constructor(options?: {defaultTimezone?: string; lockTtlMs?: number; runner?: JobRunner}) {
    this.defaultTimezone = options?.defaultTimezone ?? DEFAULT_TIMEZONE;
    this.lockTtlMs = options?.lockTtlMs ?? 15 * 60 * 1000;
    this.runner = options?.runner;
  }

  define(name: string, definition: JobDefinition): void {
    if (definition.schedule) {
      validateScheduleDefinition({
        cron: definition.schedule.cron,
        defaultTimezone: this.defaultTimezone,
        scheduleTimezone: definition.schedule.timezone,
      });
    }

    this.definitions.set(name, definition);
  }

  getDefinition(name: string): JobDefinition | undefined {
    return this.definitions.get(name);
  }

  getDefaultTimezone(): string {
    return this.defaultTimezone;
  }

  getLockTtlMs(): number {
    return this.lockTtlMs;
  }

  isSchedulesDirty(): boolean {
    return this.schedulesDirty;
  }

  markSchedulesDirty(): void {
    this.schedulesDirty = true;
  }

  async reconcileSchedulesIfDirty(): Promise<void> {
    if (!this.schedulesDirty) {
      return;
    }

    await this.reconcileSchedules();
  }

  async reconcileSchedules(): Promise<void> {
    for (const [name, definition] of this.definitions) {
      if (!definition.schedule) {
        continue;
      }

      const timezone = resolveScheduleTimezone({
        defaultTimezone: this.defaultTimezone,
        scheduleTimezone: definition.schedule.timezone,
      });
      const cron = definition.schedule.cron;
      const existing = await JobSchedule.findOneOrNone({name});

      if (!existing) {
        await JobSchedule.findOneAndUpdate(
          {name},
          {
            $setOnInsert: {
              cron,
              enabled: true,
              handlerName: name,
              nextRunAt: computeInitialNextRunAt(cron, timezone),
              timezone,
            },
          },
          {upsert: true}
        );
        continue;
      }

      const cronTimezoneChanged = existing.cron !== cron || existing.timezone !== timezone;

      const update: {
        cron: string;
        handlerName: string;
        nextRunAt?: Date;
        timezone: string;
      } = {
        cron,
        handlerName: name,
        timezone,
      };

      if (cronTimezoneChanged) {
        update.nextRunAt = computeInitialNextRunAt(cron, timezone);
      }

      await JobSchedule.updateOne({_id: existing._id}, {$set: update});
    }

    this.schedulesDirty = false;
  }

  async tickSchedules(now?: Date): Promise<void> {
    await tickDueSchedules({
      jobsService: this,
      now,
    });
  }

  async enqueue(params: EnqueueJobParams): Promise<JobDocument> {
    const definition = this.definitions.get(params.name);
    if (!definition) {
      throw new APIError({status: 400, title: UNKNOWN_JOB_NAME_TITLE});
    }

    const runAt = params.runAt ?? DateTime.utc().toJSDate();
    const maxAttempts = definition.retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const backoffMs = definition.retry?.backoffMs ?? DEFAULT_BACKOFF_MS;
    const maxBackoffMs = definition.retry?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    const idempotencyKey = params.idempotencyKey?.trim();

    if (idempotencyKey) {
      const existing = await Job.findOneOrNone({
        idempotencyKey,
        name: params.name,
      });
      if (existing) {
        return existing;
      }
    }

    const createPayload = {
      attemptCount: 0,
      backoffMs,
      maxAttempts,
      maxBackoffMs,
      name: params.name,
      payload: params.payload,
      payloadRedacted: false,
      runAt,
      status: "pending" as const,
      ...(idempotencyKey ? {idempotencyKey} : {}),
      ...(params.scheduleId ? {scheduleId: new mongoose.Types.ObjectId(params.scheduleId)} : {}),
    };

    let job: JobDocument;
    try {
      job = await Job.create(createPayload);
    } catch (error: unknown) {
      if (!idempotencyKey || !isDuplicateKeyError(error)) {
        throw error;
      }

      return Job.findExactlyOne({
        idempotencyKey,
        name: params.name,
      });
    }

    if (this.runner) {
      await dispatchJobToRunner(this.runner, job);
    }

    return job;
  }

  async adminRetryJob(jobId: string): Promise<{original: JobDocument; retry: JobDocument}> {
    if (!mongoose.isValidObjectId(jobId)) {
      throw new NotFoundError("Job not found");
    }

    const original = await Job.findOneOrNone({_id: jobId});
    if (!original) {
      throw new NotFoundError("Job not found");
    }

    if (original.retriedById) {
      throw new APIError({status: 409, title: "Job already retried"});
    }

    if (original.status !== "dead" && original.status !== "failed") {
      throw new APIError({
        detail: `Status is ${original.status}`,
        status: 400,
        title: "Job cannot be retried",
      });
    }

    const definition = this.definitions.get(original.name);
    if (!definition) {
      throw new APIError({status: 400, title: UNKNOWN_JOB_NAME_TITLE});
    }

    const now = DateTime.utc().toJSDate();
    const retry = await Job.create({
      attemptCount: 0,
      attempts: [],
      backoffMs: original.backoffMs,
      maxAttempts: original.maxAttempts,
      maxBackoffMs: original.maxBackoffMs,
      name: original.name,
      payload: original.payload,
      payloadRedacted: original.payloadRedacted,
      retriedFromId: original._id,
      runAt: now,
      scheduleId: original.scheduleId,
      status: "pending",
    });

    const linked = await Job.findOneAndUpdate(
      {
        _id: original._id,
        retriedById: {$exists: false},
        status: {$in: ["dead", "failed"]},
      },
      {$set: {retriedById: retry._id}},
      {returnDocument: "after"}
    );

    if (!linked) {
      await Job.deleteOne({_id: retry._id});
      const current = await Job.findOneOrNone({_id: original._id});
      if (current?.retriedById) {
        throw new APIError({status: 409, title: "Job already retried"});
      }

      throw new APIError({status: 409, title: "Job state changed"});
    }

    if (this.runner) {
      await dispatchJobToRunner(this.runner, retry);
    }

    return {original: linked, retry};
  }

  async adminRequeueJob(jobId: string): Promise<JobDocument> {
    if (!mongoose.isValidObjectId(jobId)) {
      throw new NotFoundError("Job not found");
    }

    const now = DateTime.utc().toJSDate();
    const requeued = await Job.findOneAndUpdate(
      {
        _id: jobId,
        retriedById: {$exists: false},
        status: {$in: ["cancelled", "dead", "failed"]},
      },
      {
        $set: {runAt: now, status: "pending"},
        $unset: {lockedAt: "", lockedBy: ""},
      },
      {returnDocument: "after"}
    );

    if (!requeued) {
      const existing = await Job.findOneOrNone({_id: jobId});
      if (!existing) {
        throw new NotFoundError("Job not found");
      }

      if (existing.retriedById) {
        throw new APIError({status: 409, title: "Job already retried"});
      }

      throw new APIError({
        detail: `Status is ${existing.status}`,
        status: 400,
        title: "Job cannot be requeued",
      });
    }

    if (this.runner) {
      await dispatchJobToRunner(this.runner, requeued);
    }

    return requeued;
  }

  async adminCancelJob(jobId: string): Promise<JobDocument> {
    if (!mongoose.isValidObjectId(jobId)) {
      throw new NotFoundError("Job not found");
    }

    const cancelled = await Job.findOneAndUpdate(
      {
        _id: jobId,
        status: {$in: ["pending", "running", "scheduled"]},
      },
      {
        $set: {status: "cancelled"},
        $unset: {lockedAt: "", lockedBy: ""},
      },
      {returnDocument: "after"}
    );

    if (!cancelled) {
      const existing = await Job.findOneOrNone({_id: jobId});
      if (!existing) {
        throw new NotFoundError("Job not found");
      }

      throw new APIError({
        detail: `Status is ${existing.status}`,
        status: 400,
        title: "Job cannot be cancelled",
      });
    }

    abortActiveJobExecution(jobId);
    return cancelled;
  }

  async pauseSchedule(name: string): Promise<JobScheduleDocument> {
    const updated = await JobSchedule.findOneAndUpdate(
      {name},
      {$set: {enabled: false}},
      {returnDocument: "after"}
    );

    if (!updated) {
      throw new NotFoundError("Schedule not found");
    }

    return updated;
  }

  async resumeSchedule(name: string): Promise<JobScheduleDocument> {
    const updated = await JobSchedule.findOneAndUpdate(
      {name},
      {$set: {enabled: true}},
      {returnDocument: "after"}
    );

    if (!updated) {
      throw new NotFoundError("Schedule not found");
    }

    return updated;
  }
}

let registeredJobsService: JobsService | undefined;

export const getJobsService = (): JobsService => {
  if (!registeredJobsService) {
    throw new APIError({status: 500, title: "JobsApp is not registered"});
  }
  return registeredJobsService;
};

export const registerJobsService = (service: JobsService): void => {
  registeredJobsService = service;
};
