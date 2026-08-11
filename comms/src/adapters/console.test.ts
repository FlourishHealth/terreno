import {describe, it, spyOn} from "bun:test";
import {logger} from "@terreno/api";
import {assert} from "chai";

import type {MailProvider, PushProvider, SmsProvider, VerificationProvider} from "../index";
import {
  ConsoleMailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
} from "./console";

describe("console communications providers", () => {
  it("accepts every channel operation and emits channel-specific logs", async (): Promise<void> => {
    const messages: string[] = [];
    const log = (message: string): void => {
      messages.push(message);
    };
    const mail: MailProvider = new ConsoleMailProvider({log});
    const sms: SmsProvider = new ConsoleSmsProvider({log});
    const push: PushProvider = new ConsolePushProvider({log});
    const verification: VerificationProvider = new ConsoleVerificationProvider({log});

    const mailResult = await mail.sendMail({
      subject: "Welcome",
      text: "Hello",
      to: "person@example.com",
    });
    const smsResult = await sms.sendSms({body: "Hello", to: "+15555550100"});
    const pushResults = await push.sendPush({
      body: "Hello",
      title: "Welcome",
      tokens: ["ExponentPushToken[first]", "ExponentPushToken[second]"],
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
    assert.lengthOf(pushResults, 2);
    assert.isTrue(pushResults.every((result) => result.accepted));
    assert.isTrue(startResult.accepted);
    assert.isTrue(checkResult.valid);
    assert.deepEqual(
      messages.map((message) => message.match(/^\[comms:[^\]]+\]/)?.[0]),
      [
        "[comms:mail]",
        "[comms:sms]",
        "[comms:push]",
        "[comms:verification:start]",
        "[comms:verification:check]",
      ]
    );
  });

  it("does not include message bodies or verification codes in logs", async (): Promise<void> => {
    const messages: string[] = [];
    const log = (message: string): void => {
      messages.push(message);
    };

    await new ConsoleSmsProvider({log}).sendSms({
      body: "Your private code is 654321",
      to: "+15555550100",
    });
    await new ConsoleVerificationProvider({log}).checkVerification({
      code: "654321",
      to: "+15555550100",
    });

    assert.notInclude(messages.join(" "), "Your private code");
    assert.notInclude(messages.join(" "), "654321");
  });

  it("uses logger.info when no log override is provided", async (): Promise<void> => {
    const messages: string[] = [];
    const info = spyOn(logger, "info").mockImplementation((message: string): void => {
      messages.push(message);
    });

    try {
      await new ConsoleMailProvider().sendMail({subject: "Welcome", to: "person@example.com"});
      await new ConsoleSmsProvider().sendSms({body: "Hello", to: "+15555550100"});
      await new ConsolePushProvider().sendPush({
        body: "Hello",
        title: "Welcome",
        tokens: ["ExponentPushToken[test]"],
      });
      await new ConsoleVerificationProvider().startVerification({
        channel: "sms",
        to: "+15555550100",
      });

      assert.lengthOf(messages, 4);
    } finally {
      info.mockRestore();
    }
  });
});
