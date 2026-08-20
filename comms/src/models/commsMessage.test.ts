import {beforeEach, describe, it} from "bun:test";
import {setupDb} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";

import {CommsMessage} from "./commsMessage";

const COMMS_MESSAGE_FIELDS = [
  "attemptCount",
  "attempts",
  "channel",
  "error",
  "errorClass",
  "errorCode",
  "lastAttemptAt",
  "metadata",
  "payload",
  "payloadExpiresAt",
  "provider",
  "providerMessageId",
  "retriedById",
  "retriedFromId",
  "status",
  "subject",
  "templateId",
  "to",
  "userId",
] as const;

describe("CommsMessage", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await CommsMessage.deleteMany({});
  });

  it("records a communication send with documented schema fields", async (): Promise<void> => {
    const message = await CommsMessage.logSend({
      channel: "mail",
      provider: "console",
      status: "sent",
      subject: "Welcome",
      to: "person@example.com",
    });

    assert.isNotNull(message);
    assert.equal(message?.channel, "mail");
    assert.equal(await CommsMessage.countDocuments(), 1);
    for (const field of COMMS_MESSAGE_FIELDS) {
      assert.isString(CommsMessage.schema.path(field).options.description);
    }
  });

  it("returns null instead of throwing when logging fails", async (): Promise<void> => {
    const result = await CommsMessage.logSend({
      channel: "mail",
      provider: "",
      status: "sent",
      to: "person@example.com",
    });

    assert.isNull(result);
    assert.equal(await CommsMessage.countDocuments(), 0);
  });

  it("accepts cancelled status and stores the first attempt on logSend", async (): Promise<void> => {
    const at = DateTime.utc().toJSDate();
    const message = await CommsMessage.logSend({
      attemptCount: 1,
      attempts: [
        {
          at,
          error: "rate limited",
          errorClass: "transient",
          errorCode: "429",
          provider: "console",
        },
      ],
      channel: "mail",
      lastAttemptAt: at,
      provider: "console",
      status: "cancelled",
      to: "[redacted]",
    });

    assert.isNotNull(message);
    assert.equal(message?.status, "cancelled");
    assert.equal(message?.attemptCount, 1);
    assert.lengthOf(message?.attempts ?? [], 1);
    assert.equal(message?.attempts[0]?.errorClass, "transient");
  });

  it("appends a second attempt onto the same row without creating another document", async (): Promise<void> => {
    const firstAt = DateTime.utc().minus({seconds: 2}).toJSDate();
    const created = await CommsMessage.logSend({
      attemptCount: 1,
      attempts: [{at: firstAt, provider: "console"}],
      channel: "sms",
      error: "timeout",
      errorClass: "transient",
      lastAttemptAt: firstAt,
      provider: "console",
      status: "failed",
      to: "[redacted]",
    });
    assert.isNotNull(created);

    const secondAt = DateTime.utc().toJSDate();
    const updated = await CommsMessage.appendAttempt({
      attempt: {
        at: secondAt,
        provider: "console",
        providerMessageId: "sms-2",
      },
      messageId: created?._id,
      providerMessageId: "sms-2",
      status: "sent",
    });

    assert.isNotNull(updated);
    assert.equal(await CommsMessage.countDocuments(), 1);
    assert.equal(updated?.status, "sent");
    assert.equal(updated?.attemptCount, 2);
    assert.lengthOf(updated?.attempts ?? [], 2);
    assert.equal(updated?.providerMessageId, "sms-2");
    assert.equal(updated?.lastAttemptAt?.toISOString(), secondAt.toISOString());
  });

  it("returns null instead of throwing when appendAttempt cannot find the row", async (): Promise<void> => {
    const result = await CommsMessage.appendAttempt({
      attempt: {at: DateTime.utc().toJSDate(), provider: "console"},
      messageId: "000000000000000000000000",
      status: "failed",
    });
    assert.isNull(result);
  });

  it("clears expired payloads without deleting log rows and does not use a TTL index", async (): Promise<void> => {
    const expired = await CommsMessage.logSend({
      channel: "mail",
      payload: {subject: "old"},
      payloadExpiresAt: DateTime.utc().minus({days: 1}).toJSDate(),
      provider: "console",
      status: "sent",
      to: "[redacted]",
    });
    assert.isNotNull(expired);

    const cleared = await CommsMessage.clearExpiredPayloads();
    assert.equal(cleared, 1);

    const fresh = await CommsMessage.logSend({
      channel: "mail",
      payload: {subject: "new"},
      payloadExpiresAt: DateTime.utc().plus({days: 30}).toJSDate(),
      provider: "console",
      status: "sent",
      to: "[redacted]",
    });
    assert.isNotNull(fresh);

    const expiredRow = await CommsMessage.findExactlyOne({_id: expired?._id});
    const freshRow = await CommsMessage.findExactlyOne({_id: fresh?._id});
    assert.isUndefined(expiredRow.payload);
    assert.deepEqual(freshRow.payload, {subject: "new"});
    assert.equal(await CommsMessage.countDocuments(), 2);

    const indexJson = JSON.stringify(CommsMessage.schema.indexes());
    assert.notInclude(indexJson.toLowerCase(), "expireafterseconds");
  });
});
