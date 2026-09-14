import {describe, it} from "bun:test";
import {assert} from "chai";

import type {
  CommsHookContext,
  CommsMessageStatus,
  CommsOptions,
  DeliveryEvent,
  OptOutEvent,
  SendResult,
} from "./types";

const cancelled: CommsMessageStatus = "cancelled";

const hookContext: CommsHookContext = {
  attempt: 2,
  channel: "mail",
  isRetry: true,
  message: {subject: "Hi", to: "person@example.com"},
  messageId: "abc",
  provider: "console",
  userId: "user-1",
};

const optOut: OptOutEvent = {
  channel: "mail",
  provider: "sendgrid",
  reason: "unsubscribe",
  to: "person@example.com",
};

const delivery: DeliveryEvent = {
  channel: "mail",
  errorClass: "permanent",
  errorCode: "bounce",
  providerMessageId: "sg-1",
  status: "bounced",
};

const onRetry: NonNullable<CommsOptions["onRetry"]> = async (
  context: CommsHookContext,
  result: SendResult
): Promise<void> => {
  assert.equal(context.attempt, 2);
  assert.equal(result.errorClass, "transient");
};

describe("comms contract types", () => {
  it("exports cancelled status, hook context, opt-out, and delivery error fields", (): void => {
    assert.equal(cancelled, "cancelled");
    assert.equal(hookContext.attempt, 2);
    assert.equal(optOut.reason, "unsubscribe");
    assert.equal(delivery.errorCode, "bounce");
    assert.equal(typeof onRetry, "function");
  });
});
