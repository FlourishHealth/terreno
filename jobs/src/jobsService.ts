import {APIError} from "@terreno/api";
import {DateTime} from "luxon";

import {Job} from "./models/job";
import type {JobDocument} from "./modelTypes";
import {DEFAULT_BACKOFF_MS, DEFAULT_MAX_BACKOFF_MS} from "./retryBackoff";
import type {EnqueueJobParams, JobDefinition} from "./types";

const DEFAULT_MAX_ATTEMPTS = 5;
const UNKNOWN_JOB_NAME_TITLE = "Unknown job name";

const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as {code: unknown}).code === 11_000
  );

export class JobsService {
  private readonly definitions = new Map<string, JobDefinition>();
  private readonly lockTtlMs: number;

  constructor(options?: {lockTtlMs?: number}) {
    this.lockTtlMs = options?.lockTtlMs ?? 15 * 60 * 1000;
  }

  define(name: string, definition: JobDefinition): void {
    this.definitions.set(name, definition);
  }

  getDefinition(name: string): JobDefinition | undefined {
    return this.definitions.get(name);
  }

  getLockTtlMs(): number {
    return this.lockTtlMs;
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
    };

    try {
      return await Job.create(createPayload);
    } catch (error: unknown) {
      if (!idempotencyKey || !isDuplicateKeyError(error)) {
        throw error;
      }

      return Job.findExactlyOne({
        idempotencyKey,
        name: params.name,
      });
    }
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
