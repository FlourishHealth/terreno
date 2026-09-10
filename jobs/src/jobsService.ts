import {APIError} from "@terreno/api";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import {dispatchJobToRunner} from "./dispatchCompensation";
import {Job} from "./models/job";
import {JobSchedule} from "./models/jobSchedule";
import type {JobDocument} from "./modelTypes";
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
