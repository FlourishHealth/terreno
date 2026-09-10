import type {DateTime} from "luxon";

export const DEFAULT_BACKOFF_MS = 1_000;
export const DEFAULT_MAX_BACKOFF_MS = 15 * 60 * 1_000;

export interface RetryBackoffOptions {
  backoffMs: number;
  maxBackoffMs: number;
}

export interface ComputeRetryDelayMsParams extends RetryBackoffOptions {
  attemptCount: number;
  random?: () => number;
}

export interface ComputeRetryRunAtParams extends ComputeRetryDelayMsParams {
  from: DateTime;
}

const equalJitterFactor = (random: () => number): number => 0.5 + random() * 0.5;

export const computeRetryDelayMs = (params: ComputeRetryDelayMsParams): number => {
  const random = params.random ?? Math.random;
  const exponent = Math.max(0, params.attemptCount - 1);
  const baseDelayMs = params.backoffMs * 2 ** exponent;
  const cappedDelayMs = Math.min(params.maxBackoffMs, baseDelayMs);
  return Math.round(cappedDelayMs * equalJitterFactor(random));
};

export const computeRetryRunAt = (params: ComputeRetryRunAtParams): DateTime =>
  params.from.plus({
    milliseconds: computeRetryDelayMs(params),
  });
