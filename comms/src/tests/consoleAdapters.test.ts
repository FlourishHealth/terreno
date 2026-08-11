import {afterEach, describe, it, spyOn} from "bun:test";
import {logger} from "@terreno/api";
import {assert} from "chai";

import {
  ConsoleMailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
} from "../adapters/console";

describe("console communications adapters", () => {
  afterEach((): void => {
    spyOn(logger, "info").mockRestore();
  });

  it("accepts mail, SMS, and push messages without external SDKs", async (): Promise<void> => {
    const infoSpy = spyOn(logger, "info").mockImplementation(() => logger);

    const mailResult = await new ConsoleMailProvider().sendMail({
      subject: "Welcome",
      text: "Hello",
      to: "person@example.com",
    });
    const smsResult = await new ConsoleSmsProvider().sendSms({body: "Hello", to: "+15555550100"});
    const pushResults = await new ConsolePushProvider().sendPush({
      body: "Hello",
      title: "Welcome",
      tokens: ["ExponentPushToken[first]", "ExponentPushToken[second]"],
    });

    assert.isTrue(mailResult.accepted);
    assert.isTrue(smsResult.accepted);
    assert.deepEqual(
      pushResults.map((result) => result.accepted),
      [true, true]
    );
    assert.equal(infoSpy.mock.calls.length, 3);
  });

  it("supports deterministic development verification", async (): Promise<void> => {
    const provider = new ConsoleVerificationProvider({code: "654321"});

    const started = await provider.startVerification({channel: "sms", to: "+15555550100"});
    const valid = await provider.checkVerification({code: "654321", to: "+15555550100"});
    const invalid = await provider.checkVerification({code: "000000", to: "+15555550100"});

    assert.isTrue(started.accepted);
    assert.isTrue(valid.valid);
    assert.isFalse(invalid.valid);
  });
});
