import {beforeEach, describe, it} from "bun:test";
import {setupDb} from "@terreno/api/testing";
import {assert} from "chai";

import {CommsMessage} from "./commsMessage";

const COMMS_MESSAGE_FIELDS = [
  "channel",
  "error",
  "metadata",
  "provider",
  "providerMessageId",
  "status",
  "subject",
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
});
