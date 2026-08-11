import {describe, it} from "bun:test";
import {assert} from "chai";

import {
  ConsoleMailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
} from "./console";

describe("console communications providers", () => {
  it("accepts every channel operation and emits a development log", async (): Promise<void> => {
    const messages: string[] = [];
    const log = (message: string): void => {
      messages.push(message);
    };
    const mail = new ConsoleMailProvider({log});
    const sms = new ConsoleSmsProvider({log});
    const push = new ConsolePushProvider({log});
    const verification = new ConsoleVerificationProvider({log});

    const mailResult = await mail.sendMail({
      subject: "Welcome",
      text: "Hello",
      to: "person@example.com",
    });
    const smsResult = await sms.sendSms({body: "Hello", to: "+15555550100"});
    const pushResults = await push.sendPush({
      body: "Hello",
      title: "Welcome",
      tokens: ["ExponentPushToken[test]"],
    });
    const startResult = await verification.startVerification({
      channel: "sms",
      to: "+15555550100",
    });
    const checkResult = await verification.checkVerification({
      code: "123456",
      to: "+15555550100",
    });

    assert.isTrue(mailResult.accepted);
    assert.isTrue(smsResult.accepted);
    assert.isTrue(pushResults[0]?.accepted);
    assert.isTrue(startResult.accepted);
    assert.isTrue(checkResult.valid);
    assert.lengthOf(messages, 5);
  });
});
