import {afterEach, describe, it} from "bun:test";
import {logger} from "@terreno/api";
import {assert} from "chai";

import {CommsMessage} from "../models/commsMessage";

describe("CommsMessage", () => {
  afterEach(async (): Promise<void> => {
    await CommsMessage.deleteMany({});
  });

  it("records a communication attempt", async (): Promise<void> => {
    const row = await CommsMessage.logSend({
      channel: "mail",
      provider: "sendgrid",
      providerMessageId: "message-1",
      status: "sent",
      to: "person@example.com",
    });

    assert.isDefined(row);
    assert.equal(row?.provider, "sendgrid");
    assert.equal(await CommsMessage.countDocuments({}), 1);
  });

  it("logs and suppresses persistence failures", async (): Promise<void> => {
    const originalCatch = logger.catch;
    const caught: unknown[] = [];
    logger.catch = (error: unknown): void => {
      caught.push(error);
    };

    try {
      const row = await CommsMessage.logSend({
        channel: "not-a-channel" as "mail",
        provider: "console",
        status: "sent",
        to: "person@example.com",
      });

      assert.isUndefined(row);
      assert.lengthOf(caught, 1);
    } finally {
      logger.catch = originalCatch;
    }
  });
});
