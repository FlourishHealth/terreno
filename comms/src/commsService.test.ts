import {beforeEach, describe, it} from "bun:test";
import {APIError} from "@terreno/api";
import {setupDb} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import {CommsService} from "./commsService";
import type {
  MailMessage,
  MailProvider,
  PushMessage,
  PushProvider,
  SendResult,
  SmsProvider,
  VerificationProvider,
} from "./index";
import {CommsMessage, PushToken} from "./index";

const captureError = async (operation: () => Promise<unknown>): Promise<unknown> => {
  try {
    await operation();
    return undefined;
  } catch (error: unknown) {
    return error;
  }
};

describe("CommsService", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Promise.all([CommsMessage.deleteMany({}), PushToken.deleteMany({})]);
  });

  it("delegates every configured channel and records each attempt", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    await PushToken.upsert(
      {token: "ExponentPushToken[test]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );

    let deliveredMail: MailMessage | undefined;
    const mail: MailProvider = {
      id: "memory-mail",
      sendMail: async (message: MailMessage): Promise<SendResult> => {
        deliveredMail = message;
        return {accepted: true, providerMessageId: "mail-1"};
      },
    };
    const sms: SmsProvider = {
      id: "memory-sms",
      sendSms: async (): Promise<SendResult> => ({
        accepted: true,
        providerMessageId: "sms-1",
      }),
    };
    const push: PushProvider = {
      id: "memory-push",
      sendPush: async (message: PushMessage): Promise<SendResult[]> =>
        message.tokens.map((_token, index) => ({
          accepted: true,
          providerMessageId: `push-${index}`,
        })),
    };
    const verification: VerificationProvider = {
      checkVerification: async (): Promise<{valid: boolean}> => ({valid: true}),
      id: "memory-verification",
      startVerification: async (): Promise<SendResult> => ({
        accepted: true,
        providerMessageId: "verification-1",
      }),
    };
    const service = new CommsService({
      defaultFrom: "sender@example.com",
      mail,
      push,
      sms,
      verification,
    });

    const mailResult = await service.sendMail({subject: "Welcome", to: "person@example.com"});
    const smsResult = await service.sendSms({body: "Hello", to: "+15555550100"});
    const pushResults = await service.sendPushToUser({body: "Hello", title: "Title", userId});
    const startResult = await service.startVerification({
      channel: "sms",
      to: "+15555550100",
    });
    const checkResult = await service.checkVerification({
      code: "123456",
      to: "+15555550100",
    });

    assert.equal(deliveredMail?.from, "sender@example.com");
    assert.isTrue(mailResult.accepted);
    assert.isTrue(smsResult.accepted);
    assert.lengthOf(pushResults, 1);
    assert.isTrue(startResult.accepted);
    assert.isTrue(checkResult.valid);
    assert.equal(await CommsMessage.countDocuments(), 5);
    assert.equal(await CommsMessage.countDocuments({to: "[redacted]"}), 5);
  });

  it("uses console providers for every unconfigured channel outside production", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    await PushToken.upsert(
      {token: "ExponentPushToken[console]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );
    const service = new CommsService();

    assert.isTrue(
      (await service.sendMail({subject: "Welcome", to: "person@example.com"})).accepted
    );
    assert.isTrue((await service.sendSms({body: "Hello", to: "+15555550100"})).accepted);
    assert.isTrue(
      (await service.sendPushToUser({body: "Hello", title: "Title", userId}))[0]?.accepted
    );
    assert.isTrue(
      (
        await service.startVerification({
          channel: "sms",
          to: "+15555550100",
        })
      ).accepted
    );
    assert.isTrue(
      (
        await service.checkVerification({
          code: "123456",
          to: "+15555550100",
        })
      ).valid
    );
    assert.equal(await CommsMessage.countDocuments(), 5);
  });

  it("throws a 501 APIError for every unconfigured channel in production", async (): Promise<void> => {
    process.env.NODE_ENV = "production";
    const service = new CommsService();
    const userId = new mongoose.Types.ObjectId();
    const operations = [
      (): Promise<unknown> => service.sendMail({subject: "Welcome", to: "person@example.com"}),
      (): Promise<unknown> => service.sendSms({body: "Hello", to: "+15555550100"}),
      (): Promise<unknown> => service.sendPushToUser({body: "Hello", title: "Title", userId}),
      (): Promise<unknown> => service.startVerification({channel: "sms", to: "+15555550100"}),
      (): Promise<unknown> => service.checkVerification({code: "123456", to: "+15555550100"}),
    ];

    for (const operation of operations) {
      const error = await captureError(operation);
      assert.instanceOf(error, APIError);
      assert.equal((error as APIError).status, 501);
      assert.equal((error as APIError).title, "Comms channel not configured");
    }
    assert.equal(await CommsMessage.countDocuments(), 0);
  });

  it("deactivates push tokens after permanent provider failures", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    const token = await PushToken.upsert(
      {token: "ExponentPushToken[dead]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );
    const push: PushProvider = {
      id: "memory-push",
      sendPush: async (): Promise<SendResult[]> => [
        {accepted: false, error: "DeviceNotRegistered", isPermanentFailure: true},
      ],
    };

    await new CommsService({push}).sendPushToUser({body: "Hello", title: "Title", userId});

    const updated = await PushToken.findExactlyOne({_id: token._id});
    assert.isFalse(updated.active);
  });
});
