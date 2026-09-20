import {createRequire} from "node:module";

import {DateTime} from "luxon";

import {type ExecuteJobOutcome, executeJobById, type JobExecutionHost} from "../jobExecutor";
import type {JobDocument} from "../modelTypes";
import type {JobRunner} from "../types";

/** Vercel Queues maximum delay and retention window (7 days). */
export const VERCEL_QUEUE_MAX_DELAY_SECONDS = 604_800;
export const VERCEL_QUEUE_DEFAULT_RETENTION_SECONDS = 86_400;
export const VERCEL_QUEUE_MIN_RETENTION_SECONDS = 60;
export const VERCEL_QUEUE_MIN_VISIBILITY_TIMEOUT_SECONDS = 30;
export const VERCEL_QUEUE_MAX_VISIBILITY_TIMEOUT_SECONDS = 3_600;
export const VERCEL_QUEUE_DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 1_800;
export const VERCEL_QUEUE_LOCKED_RETRY_SECONDS = 30;

export interface VercelQueueSendOptions {
  delaySeconds?: number;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  region?: string;
  retentionSeconds?: number;
}

export interface VercelQueueSendResult {
  messageId: string | null;
}

/** Narrow `send` seam — inject in tests; production loads `@vercel/queue`. */
export type VercelQueueSendFn = (
  topic: string,
  payload: unknown,
  options?: VercelQueueSendOptions
) => Promise<VercelQueueSendResult>;

/** `@vercel/queue` 0.5.1 message metadata (all fields required). */
export interface VercelQueueMessageMetadata {
  consumerGroup: string;
  createdAt: Date;
  deliveryCount: number;
  expiresAt: Date;
  messageId: string;
  region: string;
  topicName: string;
}

export type VercelQueueRetryDirective = {acknowledge: true} | {afterSeconds: number};

export type VercelQueueMessageHandler = (
  message: unknown,
  metadata: VercelQueueMessageMetadata
) => Promise<void>;

export type VercelQueueRetryHandler = (
  error: unknown,
  metadata: VercelQueueMessageMetadata
) => VercelQueueRetryDirective | undefined;

export type VercelHandleCallbackFn = (
  handler: VercelQueueMessageHandler,
  options?: VercelHandleCallbackOptions
) => VercelQueueRouteHandler;

export interface VercelHandleCallbackOptions {
  retry?: VercelQueueRetryHandler;
  visibilityTimeoutSeconds?: number;
}

export type VercelQueueRouteRequest = Request | {request: Request};

export type VercelQueueRouteHandler = (request: VercelQueueRouteRequest) => Promise<Response>;

export interface VercelQueuesRunnerConfig {
  /** Injected `send` for tests. Production wiring loads `@vercel/queue`. */
  send?: VercelQueueSendFn;
  region?: string;
  retentionSeconds?: number;
  /** Queue topic published by {@link VercelQueuesRunner.enqueue}. */
  topic: string;
}

export interface VercelQueuesConsumerOptions {
  handleCallback?: VercelHandleCallbackFn;
  host: JobExecutionHost;
  signal?: AbortSignal;
  visibilityTimeoutSeconds?: number;
}

interface ResolvedVercelQueuesRunnerConfig {
  region?: string;
  retentionSeconds?: number;
  topic: string;
}

const nodeRequire = createRequire(__filename);

export class VercelQueueRunAtBeyondLimitError extends Error {
  readonly maxDelaySeconds: number;
  readonly runAt: Date;

  constructor(runAt: Date, maxDelaySeconds: number) {
    super(
      `Job runAt ${runAt.toISOString()} exceeds Vercel Queue maximum delay of ${maxDelaySeconds} seconds`
    );
    this.name = "VercelQueueRunAtBeyondLimitError";
    this.runAt = runAt;
    this.maxDelaySeconds = maxDelaySeconds;
  }
}

export class VercelQueueConsumerControl extends Error {
  readonly directive: VercelQueueRetryDirective;

  constructor(directive: VercelQueueRetryDirective) {
    super("Vercel queue consumer control");
    this.name = "VercelQueueConsumerControl";
    this.directive = directive;
  }
}

const requireNonEmpty = (value: string | undefined, label: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`VercelQueuesRunner requires ${label}`);
  }
  return trimmed;
};

const validateRetentionSeconds = (retentionSeconds: number | undefined): number | undefined => {
  if (retentionSeconds === undefined) {
    return undefined;
  }

  if (
    !Number.isFinite(retentionSeconds) ||
    retentionSeconds < VERCEL_QUEUE_MIN_RETENTION_SECONDS ||
    retentionSeconds > VERCEL_QUEUE_MAX_DELAY_SECONDS
  ) {
    throw new Error(
      `VercelQueuesRunner retentionSeconds must be between ${VERCEL_QUEUE_MIN_RETENTION_SECONDS} and ${VERCEL_QUEUE_MAX_DELAY_SECONDS} seconds`
    );
  }

  return retentionSeconds;
};

const validateVisibilityTimeoutSeconds = (visibilityTimeoutSeconds: number | undefined): number => {
  if (visibilityTimeoutSeconds === undefined) {
    return VERCEL_QUEUE_DEFAULT_VISIBILITY_TIMEOUT_SECONDS;
  }

  if (
    !Number.isFinite(visibilityTimeoutSeconds) ||
    visibilityTimeoutSeconds < VERCEL_QUEUE_MIN_VISIBILITY_TIMEOUT_SECONDS ||
    visibilityTimeoutSeconds > VERCEL_QUEUE_MAX_VISIBILITY_TIMEOUT_SECONDS
  ) {
    throw new Error(
      `VercelQueuesConsumer visibilityTimeoutSeconds must be between ${VERCEL_QUEUE_MIN_VISIBILITY_TIMEOUT_SECONDS} and ${VERCEL_QUEUE_MAX_VISIBILITY_TIMEOUT_SECONDS} seconds`
    );
  }

  return visibilityTimeoutSeconds;
};

const resolveConfig = (config: VercelQueuesRunnerConfig): ResolvedVercelQueuesRunnerConfig => ({
  region: config.region?.trim() || undefined,
  retentionSeconds: validateRetentionSeconds(config.retentionSeconds),
  topic: requireNonEmpty(config.topic, "topic"),
});

const loadQueueSend = (): VercelQueueSendFn => {
  try {
    const module = nodeRequire("@vercel/queue") as {send: VercelQueueSendFn};
    return module.send;
  } catch {
    throw new Error(
      "VercelQueuesRunner requires optional peer dependency @vercel/queue. " +
        "Install it with: bun add @vercel/queue"
    );
  }
};

const loadHandleCallback = (): VercelHandleCallbackFn => {
  try {
    const module = nodeRequire("@vercel/queue") as {handleCallback: VercelHandleCallbackFn};
    return module.handleCallback;
  } catch {
    throw new Error(
      "createVercelQueuesConsumer requires optional peer dependency @vercel/queue. " +
        "Install it with: bun add @vercel/queue"
    );
  }
};

const readJobId = (message: unknown): string | undefined => {
  if (!message || typeof message !== "object" || !("jobId" in message)) {
    return undefined;
  }

  const {jobId} = message as {jobId?: unknown};
  if (typeof jobId !== "string") {
    return undefined;
  }

  const trimmed = jobId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const computeVercelQueueDelaySeconds = (
  runAt: Date,
  now = DateTime.utc()
): number | undefined => {
  const scheduled = DateTime.fromJSDate(runAt, {zone: "utc"});
  if (scheduled <= now) {
    return undefined;
  }

  const delaySeconds = Math.floor(scheduled.diff(now, "seconds").seconds);
  if (delaySeconds <= 0) {
    return undefined;
  }

  if (delaySeconds > VERCEL_QUEUE_MAX_DELAY_SECONDS) {
    throw new VercelQueueRunAtBeyondLimitError(runAt, VERCEL_QUEUE_MAX_DELAY_SECONDS);
  }

  return delaySeconds;
};

export const resolveVercelQueueSendRetentionSeconds = (
  delaySeconds: number | undefined,
  configuredRetention?: number
): number => {
  const baseRetention = configuredRetention ?? VERCEL_QUEUE_DEFAULT_RETENTION_SECONDS;
  if (delaySeconds === undefined) {
    return baseRetention;
  }

  return Math.max(baseRetention, delaySeconds);
};

/** Clamp queue retry visibility changes to the vendor 0.5.1 range (30s–1h). */
export const clampVercelQueueRetryAfterSeconds = (seconds: number): number =>
  Math.max(
    VERCEL_QUEUE_MIN_VISIBILITY_TIMEOUT_SECONDS,
    Math.min(seconds, VERCEL_QUEUE_MAX_VISIBILITY_TIMEOUT_SECONDS)
  );

/**
 * Seconds until {@link runAt}, clamped for `handleCallback` retry visibility (30–3600).
 * not_due jobs more than 1h away retry at 3600s until due.
 */
export const computeVercelQueueRetryAfterSeconds = (runAt: Date, now = DateTime.utc()): number => {
  const seconds = Math.ceil(DateTime.fromJSDate(runAt, {zone: "utc"}).diff(now, "seconds").seconds);
  if (seconds <= 0) {
    return VERCEL_QUEUE_MIN_VISIBILITY_TIMEOUT_SECONDS;
  }

  return clampVercelQueueRetryAfterSeconds(seconds);
};

export const buildVercelQueueSendOptions = (
  job: JobDocument,
  config: {region?: string; retentionSeconds?: number},
  now = DateTime.utc()
): VercelQueueSendOptions => {
  const delaySeconds = computeVercelQueueDelaySeconds(job.runAt, now);
  const retentionSeconds = resolveVercelQueueSendRetentionSeconds(
    delaySeconds,
    config.retentionSeconds
  );

  return {
    idempotencyKey: job._id.toString(),
    retentionSeconds,
    ...(config.region ? {region: config.region} : {}),
    ...(delaySeconds !== undefined ? {delaySeconds} : {}),
  };
};

const normalizeRetryDirective = (
  directive: VercelQueueRetryDirective
): VercelQueueRetryDirective => {
  if ("acknowledge" in directive) {
    return directive;
  }

  return {afterSeconds: clampVercelQueueRetryAfterSeconds(directive.afterSeconds)};
};

export const resolveVercelQueueConsumerRetry = (
  error: unknown
): VercelQueueRetryDirective | undefined => {
  if (error instanceof VercelQueueConsumerControl) {
    return normalizeRetryDirective(error.directive);
  }

  return undefined;
};

export const applyVercelQueueExecutionOutcome = (outcome: ExecuteJobOutcome): void => {
  if (outcome.kind === "not_found") {
    throw new VercelQueueConsumerControl({acknowledge: true});
  }

  if (outcome.kind === "noop") {
    return;
  }

  if (outcome.kind === "conflict") {
    if (outcome.reason === "not_due") {
      throw new VercelQueueConsumerControl({
        afterSeconds: computeVercelQueueRetryAfterSeconds(outcome.runAt),
      });
    }

    throw new VercelQueueConsumerControl({afterSeconds: VERCEL_QUEUE_LOCKED_RETRY_SECONDS});
  }

  if (outcome.job.status === "pending") {
    const now = DateTime.utc();
    const afterSeconds =
      outcome.job.runAt > now.toJSDate()
        ? computeVercelQueueRetryAfterSeconds(outcome.job.runAt, now)
        : VERCEL_QUEUE_MIN_VISIBILITY_TIMEOUT_SECONDS;

    throw new VercelQueueConsumerControl({afterSeconds});
  }
};

/**
 * Dispatch-only runner that publishes `{jobId}` to a Vercel Queue topic via `send`.
 *
 * Required `vercel.json` consumer (private route — platform auth only):
 * `"experimentalTriggers": [{ "type": "queue/v2beta", "topic": "<topic>" }]`
 */
export class VercelQueuesRunner implements JobRunner {
  readonly id = "vercel-queues";
  /**
   * Vercel push consumers are private `handleCallback` routes, not Express
   * `POST /jobs/execute`. Use {@link createVercelQueuesConsumer} on the consumer route.
   */
  readonly requiresExecuteRoute = false;

  private readonly config: ResolvedVercelQueuesRunnerConfig;
  private readonly send: VercelQueueSendFn;

  constructor(config: VercelQueuesRunnerConfig) {
    this.config = resolveConfig(config);
    this.send = config.send ?? loadQueueSend();
  }

  async enqueue(job: JobDocument): Promise<void> {
    const payload = {jobId: job._id.toString()};
    const options = buildVercelQueueSendOptions(job, this.config);

    await this.send(this.config.topic, payload, options);
  }
}

/**
 * Wraps vendor `handleCallback` to execute a queued `{jobId}` through Terreno's
 * Mongo-backed {@link executeJobById} seam. Platform auth stays in the vendor handler.
 */
export const createVercelQueuesConsumer = (
  options: VercelQueuesConsumerOptions
): VercelQueueRouteHandler => {
  const handleCallback = options.handleCallback ?? loadHandleCallback();
  const signal = options.signal ?? AbortSignal.timeout(30 * 60 * 1_000);
  const visibilityTimeoutSeconds = validateVisibilityTimeoutSeconds(
    options.visibilityTimeoutSeconds
  );

  return handleCallback(
    async (message: unknown) => {
      const jobId = readJobId(message);
      if (!jobId) {
        throw new VercelQueueConsumerControl({acknowledge: true});
      }

      const outcome = await executeJobById({
        host: options.host,
        jobId,
        signal,
      });
      applyVercelQueueExecutionOutcome(outcome);
    },
    {
      retry: resolveVercelQueueConsumerRetry,
      visibilityTimeoutSeconds,
    }
  );
};
