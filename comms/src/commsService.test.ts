import {beforeEach, describe, it} from "bun:test";
import {type APIError, isAPIError} from "@terreno/api";
import {setupDb} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import {CommsService} from "./commsService";
import type {
  CheckVerificationOptions,
  MailMessage,
  MailProvider,
  PushMessage,
  PushProvider,
  SendResult,
  SmsProvider,
  StartVerificationOptions,
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
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "mail",
        provider: "memory-mail",
        providerMessageId: "mail-1",
        status: "sent",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "sms",
        provider: "memory-sms",
        providerMessageId: "sms-1",
        status: "sent",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "push",
        provider: "memory-push",
        providerMessageId: "push-0",
        status: "sent",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        provider: "memory-verification",
        status: "sent",
      }),
      2
    );
  });

  it("supports starting and checking both SMS and email verification", async (): Promise<void> => {
    const started: StartVerificationOptions[] = [];
    const checked: CheckVerificationOptions[] = [];
    const verification: VerificationProvider = {
      checkVerification: async (options): Promise<{valid: boolean}> => {
        checked.push(options);
        return {valid: true};
      },
      id: "multi-channel-verification",
      startVerification: async (options): Promise<SendResult> => {
        started.push(options);
        return {accepted: true};
      },
    };
    const service = new CommsService({verification});

    const smsStart = await service.startVerification({
      channel: "sms",
      to: "+15555550100",
    });
    const emailStart = await service.startVerification({
      channel: "email",
      to: "person@example.com",
    });
    const smsCheck = await service.checkVerification({
      code: "123456",
      to: "+15555550100",
    });
    const emailCheck = await service.checkVerification({
      code: "654321",
      to: "person@example.com",
    });

    assert.isTrue(smsStart.accepted);
    assert.isTrue(emailStart.accepted);
    assert.isTrue(smsCheck.valid);
    assert.isTrue(emailCheck.valid);
    assert.deepEqual(started, [
      {channel: "sms", to: "+15555550100"},
      {channel: "email", to: "person@example.com"},
    ]);
    assert.deepEqual(checked, [
      {code: "123456", to: "+15555550100"},
      {code: "654321", to: "person@example.com"},
    ]);
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        provider: "multi-channel-verification",
        status: "sent",
        to: "[redacted]",
      }),
      4
    );
    assert.equal(await CommsMessage.countDocuments({to: "+15555550100"}), 0);
    assert.equal(await CommsMessage.countDocuments({to: "person@example.com"}), 0);
    assert.equal(await CommsMessage.countDocuments({"metadata.verificationChannel": "sms"}), 1);
    assert.equal(await CommsMessage.countDocuments({"metadata.verificationChannel": "email"}), 1);
    const serializedAuditRows = JSON.stringify(
      await CommsMessage.find({provider: "multi-channel-verification"})
    );
    for (const sensitiveValue of ["+15555550100", "person@example.com", "123456", "654321"]) {
      assert.notInclude(serializedAuditRows, sensitiveValue);
    }
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
    assert.isTrue(
      (
        await service.startVerification({
          channel: "email",
          to: "person@example.com",
        })
      ).accepted
    );
    assert.isTrue(
      (
        await service.checkVerification({
          code: "654321",
          to: "person@example.com",
        })
      ).valid
    );
    assert.equal(await CommsMessage.countDocuments(), 7);
    assert.equal(await CommsMessage.countDocuments({provider: "console", to: "[redacted]"}), 7);
    assert.equal(await CommsMessage.countDocuments({to: "person@example.com"}), 0);
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
      (): Promise<unknown> =>
        service.startVerification({channel: "email", to: "person@example.com"}),
      (): Promise<unknown> => service.checkVerification({code: "654321", to: "person@example.com"}),
    ];

    for (const operation of operations) {
      const error = await captureError(operation);
      assert.isTrue(isAPIError(error));
      assert.equal((error as APIError).status, 501);
      assert.equal((error as APIError).title, "Comms channel not configured");
    }
    assert.equal(await CommsMessage.countDocuments(), 0);
  });

  it("records failed rows when configured providers throw", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    await PushToken.upsert(
      {token: "ExponentPushToken[throw]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );
    const throwProviderError = async (): Promise<never> => {
      throw new Error("Provider unavailable");
    };
    const service = new CommsService({
      mail: {id: "throw-mail", sendMail: throwProviderError},
      push: {id: "throw-push", sendPush: throwProviderError},
      sms: {id: "throw-sms", sendSms: throwProviderError},
      verification: {
        checkVerification: throwProviderError,
        id: "throw-verification",
        startVerification: throwProviderError,
      },
    });
    const operations = [
      (): Promise<unknown> => service.sendMail({subject: "Welcome", to: "person@example.com"}),
      (): Promise<unknown> => service.sendSms({body: "Hello", to: "+15555550100"}),
      (): Promise<unknown> => service.sendPushToUser({body: "Hello", title: "Title", userId}),
      (): Promise<unknown> => service.startVerification({channel: "sms", to: "+15555550100"}),
      (): Promise<unknown> => service.checkVerification({code: "654321", to: "+15555550100"}),
      (): Promise<unknown> =>
        service.startVerification({channel: "email", to: "person@example.com"}),
      (): Promise<unknown> => service.checkVerification({code: "123456", to: "person@example.com"}),
    ];

    for (const operation of operations) {
      const error = await captureError(operation);
      assert.instanceOf(error, Error);
    }

    assert.equal(await CommsMessage.countDocuments({status: "failed"}), 7);
    assert.equal(await CommsMessage.countDocuments({to: "[redacted]"}), 7);
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "mail",
        error: "Provider send failed",
        provider: "throw-mail",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        error: "Provider send failed",
        "metadata.verificationChannel": "sms",
        provider: "throw-verification",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "sms",
        error: "Provider send failed",
        provider: "throw-sms",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "push",
        error: "Provider send failed",
        provider: "throw-push",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        error: "Provider send failed",
        "metadata.verificationChannel": "email",
        provider: "throw-verification",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        error: "Provider check failed",
        provider: "throw-verification",
        status: "failed",
      }),
      2
    );
    assert.equal(await CommsMessage.countDocuments({to: "+15555550100"}), 0);
    assert.equal(await CommsMessage.countDocuments({to: "person@example.com"}), 0);
  });

  it("logs missing push results as temporary failures without pruning tokens", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    const tokens = await Promise.all(
      ["first", "second"].map(
        async (suffix): Promise<Awaited<ReturnType<typeof PushToken.upsert>>> =>
          PushToken.upsert(
            {token: `ExponentPushToken[${suffix}]`},
            {
              active: true,
              lastSeenAt: DateTime.utc().toJSDate(),
              platform: "ios",
              userId,
            }
          )
      )
    );
    const push: PushProvider = {
      id: "short-results",
      sendPush: async (): Promise<SendResult[]> => [{accepted: true}],
    };

    const results = await new CommsService({push}).sendPushToUser({
      body: "Hello",
      title: "Title",
      userId,
    });

    assert.lengthOf(results, 2);
    assert.isTrue(results[0]?.accepted);
    assert.isFalse(results[1]?.accepted);
    assert.equal(await CommsMessage.countDocuments({status: "sent"}), 1);
    assert.equal(await CommsMessage.countDocuments({status: "failed"}), 1);
    for (const token of tokens) {
      const updated = await PushToken.findExactlyOne({_id: token._id});
      assert.isTrue(updated.active);
    }
  });

  it("ignores provider push results that do not correspond to a token", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    await PushToken.upsert(
      {token: "ExponentPushToken[single]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );
    const push: PushProvider = {
      id: "extra-results",
      sendPush: async (): Promise<SendResult[]> => [
        {accepted: true, providerMessageId: "expected"},
        {accepted: false, isPermanentFailure: true, providerMessageId: "extra"},
      ],
    };

    const results = await new CommsService({push}).sendPushToUser({
      body: "Hello",
      title: "Title",
      userId,
    });

    assert.lengthOf(results, 1);
    assert.equal(results[0]?.providerMessageId, "expected");
    assert.equal(await CommsMessage.countDocuments(), 1);
    assert.equal(await CommsMessage.countDocuments({providerMessageId: "extra"}), 0);
  });

  it("keeps tokens active after explicit non-permanent provider failures", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    const token = await PushToken.upsert(
      {token: "ExponentPushToken[temporary]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );
    const push: PushProvider = {
      id: "temporary-failure",
      sendPush: async (): Promise<SendResult[]> => [
        {accepted: false, error: "Rate limited", isPermanentFailure: false},
      ],
    };

    await new CommsService({push}).sendPushToUser({body: "Hello", title: "Title", userId});

    const updated = await PushToken.findExactlyOne({_id: token._id});
    assert.isTrue(updated.active);
  });

  it("records an invalid verification check as failed", async (): Promise<void> => {
    const verification: VerificationProvider = {
      checkVerification: async ({code}): Promise<{error?: string; valid: boolean}> =>
        code === "missing-reason"
          ? {valid: false}
          : {
              error: "Verification expired",
              valid: false,
            },
      id: "memory-verification",
      startVerification: async (): Promise<SendResult> => ({accepted: true}),
    };

    const service = new CommsService({verification});
    const emailResult = await service.checkVerification({
      code: "wrong-code",
      to: "person@example.com",
    });
    const smsResult = await service.checkVerification({
      code: "wrong-code",
      to: "+15555550100",
    });
    const fallbackResult = await service.checkVerification({
      code: "missing-reason",
      to: "fallback@example.com",
    });

    assert.isFalse(emailResult.valid);
    assert.equal(emailResult.error, "Verification expired");
    assert.isFalse(smsResult.valid);
    assert.equal(smsResult.error, "Verification expired");
    assert.isFalse(fallbackResult.valid);
    assert.isUndefined(fallbackResult.error);
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        error: "Verification expired",
        status: "failed",
        to: "[redacted]",
      }),
      2
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        error: "Verification check failed",
        status: "failed",
        to: "[redacted]",
      }),
      1
    );
    assert.equal(await CommsMessage.countDocuments({to: "person@example.com"}), 0);
    assert.equal(await CommsMessage.countDocuments({to: "+15555550100"}), 0);
    const serializedAuditRows = JSON.stringify(
      await CommsMessage.find({channel: "verification", status: "failed"})
    );
    for (const sensitiveValue of ["wrong-code", "missing-reason", "fallback@example.com"]) {
      assert.notInclude(serializedAuditRows, sensitiveValue);
    }
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
