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

  it("clears expired payloads without deleting the log row", async (): Promise<void> => {
    const message = await CommsMessage.logSend({
      attemptCount: 1,
      attempts: [{at: DateTime.utc().toJSDate(), provider: "console"}],
      channel: "mail",
      payload: {subject: "Welcome"},
      payloadExpiresAt: DateTime.utc().minus({days: 1}).toJSDate(),
      provider: "console",
      status: "sent",
      to: "person@example.com",
    });
    assert.isNotNull(message);
    const refreshed = await CommsMessage.findExactlyOne({_id: message?._id});
    assert.isUndefined(refreshed.payload);
    assert.isUndefined(refreshed.payloadExpiresAt);
    assert.equal(refreshed.status, "sent");
  });

  it("appends a second attempt onto the same row", async (): Promise<void> => {
    const created = await CommsMessage.logSend({
      attemptCount: 1,
      attempts: [{at: DateTime.utc().toJSDate(), errorCode: "429", provider: "console"}],
      channel: "mail",
      errorClass: "transient",
      errorCode: "429",
      provider: "console",
      status: "failed",
      to: "person@example.com",
    });
    assert.isNotNull(created);
    const appended = await CommsMessage.appendAttempt({
      attempt: {
        at: DateTime.utc().toJSDate(),
        provider: "console",
        providerMessageId: "mail-2",
      },
      id: String(created?._id),
      providerMessageId: "mail-2",
      status: "sent",
    });
    assert.equal(appended?.attemptCount, 2);
    assert.equal(await CommsMessage.countDocuments(), 1);
    assert.equal(appended?.status, "sent");
  });
});
