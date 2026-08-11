import {describe, it, spyOn} from "bun:test";
import {logger} from "@terreno/api";
import {assert} from "chai";

import type {
  CheckVerificationOptions,
  CommsChannel,
  CommsMessageStatus,
  CommsOptions,
  DeliveryEvent,
  MailMessage,
  MailProvider,
  PushMessage,
  PushProvider,
  SendPushToUserMessage,
  SendResult,
  SmsMessage,
  SmsProvider,
  StartVerificationOptions,
  VerificationProvider,
  VerificationResult,
} from "../index";
import {
  ConsoleMailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
} from "../index";

describe("console communications providers", () => {
  it("exports the complete provider contract surface", (): void => {
    const mailMessage: MailMessage = {subject: "Subject", to: "person@example.com"};
    const smsMessage: SmsMessage = {body: "Body", to: "+15555550100"};
    const pushMessage: PushMessage = {body: "Body", title: "Title", tokens: ["token"]};
    const pushToUserMessage: SendPushToUserMessage = {
      body: "Body",
      title: "Title",
      userId: "user-id",
    };
    const start: StartVerificationOptions = {channel: "sms", to: "+15555550100"};
    const check: CheckVerificationOptions = {code: "123456", to: "+15555550100"};
    const result: SendResult = {accepted: true};
    const verificationResult: VerificationResult = {valid: true};
    const delivery: DeliveryEvent = {
      channel: "mail",
      providerMessageId: "provider-id",
      status: "delivered",
    };
    const channel: CommsChannel = "mail";
    const status: CommsMessageStatus = "sent";
    const options: CommsOptions = {defaultFrom: "sender@example.com"};

    assert.deepEqual(
      {
        channel,
        check,
        delivery,
        mailMessage,
        options,
        pushMessage,
        pushToUserMessage,
        result,
        smsMessage,
        start,
        status,
        verificationResult,
      },
      {
        channel: "mail",
        check: {code: "123456", to: "+15555550100"},
        delivery: {
          channel: "mail",
          providerMessageId: "provider-id",
          status: "delivered",
        },
        mailMessage: {subject: "Subject", to: "person@example.com"},
        options: {defaultFrom: "sender@example.com"},
        pushMessage: {body: "Body", title: "Title", tokens: ["token"]},
        pushToUserMessage: {body: "Body", title: "Title", userId: "user-id"},
        result: {accepted: true},
        smsMessage: {body: "Body", to: "+15555550100"},
        start: {channel: "sms", to: "+15555550100"},
        status: "sent",
        verificationResult: {valid: true},
      }
    );
  });

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
    assert.deepEqual(messages, [
      "[comms:mail] recipients=1 subjectLength=7",
      "[comms:sms] bodyLength=5",
      "[comms:push] tokens=2 titleLength=7",
      "[comms:verification:start] channel=sms",
      "[comms:verification:check]",
    ]);
  });

  it("does not include content or recipient identifiers in logs", async (): Promise<void> => {
    const messages: string[] = [];
    const log = (message: string): void => {
      messages.push(message);
    };

    await new ConsoleMailProvider({log}).sendMail({
      subject: "Private reset token 654321",
      text: "Private mail body",
      to: "private@example.com",
    });
    await new ConsoleSmsProvider({log}).sendSms({
      body: "Your private code is 654321",
      to: "+15555550100",
    });
    await new ConsoleVerificationProvider({log}).checkVerification({
      code: "654321",
      to: "+15555550100",
    });
    await new ConsolePushProvider({log}).sendPush({
      body: "Private push body",
      title: "Private push title",
      tokens: ["ExponentPushToken[private-token]"],
    });

    assert.notInclude(messages.join(" "), "Your private code");
    assert.notInclude(messages.join(" "), "Private reset token");
    assert.notInclude(messages.join(" "), "private@example.com");
    assert.notInclude(messages.join(" "), "+15555550100");
    assert.notInclude(messages.join(" "), "Private push body");
    assert.notInclude(messages.join(" "), "Private push title");
    assert.notInclude(messages.join(" "), "ExponentPushToken[private-token]");
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

      assert.deepEqual(messages, [
        "[comms:mail] recipients=1 subjectLength=7",
        "[comms:sms] bodyLength=5",
        "[comms:push] tokens=1 titleLength=7",
        "[comms:verification:start] channel=sms",
      ]);
      assert.notInclude(messages.join(" "), "person@example.com");
      assert.notInclude(messages.join(" "), "+15555550100");
    } finally {
      info.mockRestore();
    }
  });
});
