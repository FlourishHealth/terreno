import {APIError} from "@terreno/api";
import {DateTime} from "luxon";

import {Job} from "./models/job";
import type {JobDocument} from "./modelTypes";
import type {EnqueueJobParams, JobDefinition} from "./types";

const DEFAULT_MAX_ATTEMPTS = 5;
const UNKNOWN_JOB_NAME_TITLE = "Unknown job name";

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

    return Job.create({
      attemptCount: 0,
      idempotencyKey: params.idempotencyKey,
      maxAttempts,
      name: params.name,
      payload: params.payload,
      payloadRedacted: false,
      runAt,
      status: "pending",
    });
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
