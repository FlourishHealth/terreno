import {describe, it} from "bun:test";
import {assert} from "chai";
import {DateTime} from "luxon";

import {
  computeRetryDelayMs,
  computeRetryRunAt,
  DEFAULT_BACKOFF_MS,
  DEFAULT_MAX_BACKOFF_MS,
} from "../retryBackoff";

describe("retryBackoff", () => {
  it("defaults backoffMs to 1000 and maxBackoffMs to 15 minutes", (): void => {
    assert.equal(DEFAULT_BACKOFF_MS, 1_000);
    assert.equal(DEFAULT_MAX_BACKOFF_MS, 15 * 60 * 1_000);
  });

  it("uses exponential backoff capped by maxBackoffMs with injected random", (): void => {
    const retry = {backoffMs: 1_000, maxBackoffMs: 10_000};
    const random = (): number => 0;

    assert.equal(
      computeRetryDelayMs({
        attemptCount: 1,
        backoffMs: retry.backoffMs,
        maxBackoffMs: retry.maxBackoffMs,
        random,
      }),
      500,
      "first failure uses backoffMs * 2^0 with equal jitter floor"
    );
    assert.equal(
      computeRetryDelayMs({
        attemptCount: 2,
        backoffMs: retry.backoffMs,
        maxBackoffMs: retry.maxBackoffMs,
        random,
      }),
      1_000,
      "second failure uses backoffMs * 2^1 with equal jitter floor"
    );
    assert.equal(
      computeRetryDelayMs({
        attemptCount: 5,
        backoffMs: retry.backoffMs,
        maxBackoffMs: retry.maxBackoffMs,
        random,
      }),
      5_000,
      "attemptCount 5 applies backoffMs * 2^4 before cap"
    );
    assert.equal(
      computeRetryDelayMs({
        attemptCount: 10,
        backoffMs: retry.backoffMs,
        maxBackoffMs: retry.maxBackoffMs,
        random,
      }),
      5_000,
      "delay is capped at half of maxBackoffMs with zero random"
    );
  });

  it("computes runAt from Luxon with deterministic jitter", (): void => {
    const from = DateTime.utc(2026, 9, 10, 12, 0, 0);
    const runAt = computeRetryRunAt({
      attemptCount: 2,
      backoffMs: 1_000,
      from,
      maxBackoffMs: 60_000,
      random: () => 1,
    });

    assert.equal(runAt.toMillis(), from.plus({milliseconds: 2_000}).toMillis());
  });
});
