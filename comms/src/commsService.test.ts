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
    const mailResult = await service.sendMail({subject: "Welcome", to: "person@example.com"});
    const smsResult = await service.sendSms({body: "Hello", to: "+15555550100"});
    const pushResults = await service.sendPushToUser({body: "Hello", title: "Title", userId});
    const startSms = await service.startVerification({channel: "sms", to: "+15555550100"});
    const checkSms = await service.checkVerification({code: "654321", to: "+15555550100"});
    const startEmail = await service.startVerification({
      channel: "email",
      to: "person@example.com",
    });
    const checkEmail = await service.checkVerification({
      code: "123456",
      to: "person@example.com",
    });

    assert.isFalse(mailResult.accepted);
    assert.equal(mailResult.error, "Provider unavailable");
    assert.equal(mailResult.errorClass, "transient");
    assert.equal(mailResult.errorCode, "provider-throw");
    assert.isFalse(smsResult.accepted);
    assert.equal(smsResult.errorClass, "transient");
    assert.isFalse(pushResults[0]?.accepted);
    assert.equal(pushResults[0]?.errorClass, "transient");
    assert.isFalse(startSms.accepted);
    assert.isFalse(checkSms.valid);
    assert.isFalse(startEmail.accepted);
    assert.isFalse(checkEmail.valid);

    assert.equal(await CommsMessage.countDocuments({status: "failed"}), 7);
    assert.equal(await CommsMessage.countDocuments({to: "[redacted]"}), 7);
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "mail",
        error: "Provider unavailable",
        errorClass: "transient",
        provider: "throw-mail",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        error: "Provider unavailable",
        "metadata.verificationChannel": "sms",
        provider: "throw-verification",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "sms",
        error: "Provider unavailable",
        provider: "throw-sms",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "push",
        error: "Provider unavailable",
        provider: "throw-push",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        error: "Provider unavailable",
        "metadata.verificationChannel": "email",
        provider: "throw-verification",
        status: "failed",
      }),
      1
    );
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "verification",
        error: "Provider unavailable",
        provider: "throw-verification",
        status: "failed",
      }),
      4
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

  it("invokes onSend and onError hooks for every channel", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    await PushToken.upsert(
      {token: "ExponentPushToken[hooks]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );

    const onSendChannels: string[] = [];
    const onErrorChannels: string[] = [];
    const service = new CommsService({
      mail: {
        id: "hook-mail",
        sendMail: async (): Promise<SendResult> => ({accepted: true}),
      },
      onError: async (context): Promise<void> => {
        onErrorChannels.push(context.channel);
      },
      onSend: async (context): Promise<void> => {
        onSendChannels.push(context.channel);
      },
      push: {
        id: "hook-push",
        sendPush: async (): Promise<SendResult[]> => [{accepted: true}],
      },
      sms: {
        id: "hook-sms",
        sendSms: async (): Promise<SendResult> => ({accepted: true}),
      },
      verification: {
        checkVerification: async (): Promise<{valid: boolean}> => ({error: "bad", valid: false}),
        id: "hook-verification",
        startVerification: async (): Promise<SendResult> => ({accepted: true}),
      },
    });

    await service.sendMail({subject: "Welcome", to: "person@example.com"});
    await service.sendSms({body: "Hello", to: "+15555550100"});
    await service.sendPushToUser({body: "Hello", title: "Title", userId});
    await service.startVerification({channel: "sms", to: "+15555550100"});
    await service.checkVerification({code: "123456", to: "+15555550100"});

    assert.deepEqual(onSendChannels, ["mail", "sms", "push", "verification"]);
    assert.deepEqual(onErrorChannels, ["verification"]);
  });

  it("invokes onError per token when push provider throws for multiple tokens", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    await PushToken.upsert(
      {token: "ExponentPushToken[hooks-a]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );
    await PushToken.upsert(
      {token: "ExponentPushToken[hooks-b]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );

    let onErrorCount = 0;
    const service = new CommsService({
      onError: async (): Promise<void> => {
        onErrorCount += 1;
      },
      push: {
        id: "throw-push",
        sendPush: async (): Promise<never> => {
          throw new Error("Provider unavailable");
        },
      },
    });

    const results = await service.sendPushToUser({body: "Hello", title: "Title", userId});
    assert.lengthOf(results, 2);
    assert.isFalse(results[0]?.accepted);
    assert.equal(onErrorCount, 2);
    assert.equal(
      await CommsMessage.countDocuments({
        channel: "push",
        error: "Provider unavailable",
        provider: "throw-push",
        status: "failed",
      }),
      2
    );
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

  it("retries SMS and verification start once on transient failure and never retries checks", async (): Promise<void> => {
    let smsCalls = 0;
    let startCalls = 0;
    let checkCalls = 0;
    const service = new CommsService({
      sms: {
        id: "retry-sms",
        sendSms: async (): Promise<SendResult> => {
          smsCalls += 1;
          if (smsCalls === 1) {
            return {accepted: false, errorClass: "transient", errorCode: "429"};
          }
          return {accepted: true, providerMessageId: "sms-ok"};
        },
      },
      verification: {
        checkVerification: async (): Promise<{valid: boolean}> => {
          checkCalls += 1;
          return {error: "bad", valid: false};
        },
        id: "retry-verification",
        startVerification: async (): Promise<SendResult> => {
          startCalls += 1;
          if (startCalls === 1) {
            return {accepted: false, errorClass: "transient", errorCode: "429"};
          }
          return {accepted: true, providerMessageId: "verify-ok"};
        },
      },
    });

    const smsResult = await service.sendSms({body: "Hello", to: "+15555550100"});
    const startResult = await service.startVerification({channel: "sms", to: "+15555550100"});
    const checkResult = await service.checkVerification({code: "123456", to: "+15555550100"});

    assert.isTrue(smsResult.accepted);
    assert.isTrue(startResult.accepted);
    assert.isFalse(checkResult.valid);
    assert.equal(smsCalls, 2);
    assert.equal(startCalls, 2);
    assert.equal(checkCalls, 1);
    assert.equal(await CommsMessage.countDocuments({channel: "sms"}), 1);
    assert.equal(await CommsMessage.countDocuments({channel: "verification"}), 2);
  });

  it("does not retry permanent or config SMS failures", async (): Promise<void> => {
    let calls = 0;
    const service = new CommsService({
      sms: {
        id: "permanent-sms",
        sendSms: async (): Promise<SendResult> => {
          calls += 1;
          return {accepted: false, errorClass: "permanent", errorCode: "21614"};
        },
      },
    });

    const result = await service.sendSms({body: "Hello", to: "+15555550100"});
    assert.isFalse(result.accepted);
    assert.equal(calls, 1);
  });

  it("retries only push tokens with transient errorClass and prunes permanent class failures", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    const keep = await PushToken.upsert(
      {token: "ExponentPushToken[keep]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );
    const retryToken = await PushToken.upsert(
      {token: "ExponentPushToken[retry]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "android",
        userId,
      }
    );
    const dead = await PushToken.upsert(
      {token: "ExponentPushToken[class-dead]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "web",
        userId,
      }
    );

    const pushCalls: string[][] = [];
    const push: PushProvider = {
      id: "mixed-push",
      sendPush: async (message: PushMessage): Promise<SendResult[]> => {
        pushCalls.push([...message.tokens]);
        return message.tokens.map((token): SendResult => {
          if (token === "ExponentPushToken[keep]") {
            return {accepted: true, providerMessageId: "keep-ok"};
          }
          if (token === "ExponentPushToken[retry]") {
            if (pushCalls.length === 1) {
              return {accepted: false, errorClass: "transient", errorCode: "429"};
            }
            return {accepted: true, providerMessageId: "retry-ok"};
          }
          return {accepted: false, errorClass: "permanent", errorCode: "DeviceNotRegistered"};
        });
      },
    };

    const results = await new CommsService({push}).sendPushToUser({
      body: "Hello",
      title: "Title",
      userId,
    });

    assert.lengthOf(results, 3);
    assert.isTrue(results[0]?.accepted);
    assert.isTrue(results[1]?.accepted);
    assert.isFalse(results[2]?.accepted);
    assert.deepEqual(pushCalls[0], [
      "ExponentPushToken[keep]",
      "ExponentPushToken[retry]",
      "ExponentPushToken[class-dead]",
    ]);
    assert.deepEqual(pushCalls[1], ["ExponentPushToken[retry]"]);
    assert.isTrue((await PushToken.findExactlyOne({_id: keep._id})).active);
    assert.isTrue((await PushToken.findExactlyOne({_id: retryToken._id})).active);
    assert.isFalse((await PushToken.findExactlyOne({_id: dead._id})).active);
  });

  it("lets beforeSend mutate a message and cancel without calling the provider", async (): Promise<void> => {
    let sendCalls = 0;
    const service = new CommsService({
      beforeSend: async (context) => {
        if (context.channel === "sms") {
          return {cancel: true};
        }
        return {
          message: {
            subject: "Mutated",
            to: "person@example.com",
          },
        };
      },
      mail: {
        id: "hook-mail",
        sendMail: async (message: MailMessage): Promise<SendResult> => {
          sendCalls += 1;
          return {accepted: true, providerMessageId: message.subject};
        },
      },
      sms: {
        id: "hook-sms",
        sendSms: async (): Promise<SendResult> => {
          sendCalls += 1;
          return {accepted: true};
        },
      },
    });

    const mailResult = await service.sendMail({subject: "Original", to: "person@example.com"});
    const smsResult = await service.sendSms({body: "Hello", to: "+15555550100"});

    assert.isTrue(mailResult.accepted);
    assert.equal(mailResult.providerMessageId, "Mutated");
    assert.isFalse(smsResult.accepted);
    assert.equal(sendCalls, 1);
    assert.equal(await CommsMessage.countDocuments({channel: "sms", status: "cancelled"}), 1);
    assert.equal(await CommsMessage.countDocuments({channel: "mail", status: "sent"}), 1);
  });

  it("ignores a throwing beforeSend and still sends", async (): Promise<void> => {
    const service = new CommsService({
      beforeSend: async (): Promise<never> => {
        throw new Error("beforeSend boom");
      },
      mail: {
        id: "hook-mail",
        sendMail: async (): Promise<SendResult> => ({accepted: true, providerMessageId: "ok"}),
      },
    });

    const result = await service.sendMail({subject: "Welcome", to: "person@example.com"});
    assert.isTrue(result.accepted);
    assert.equal(await CommsMessage.countDocuments({status: "sent"}), 1);
  });

  it("does not change the send outcome when outcome hooks throw", async (): Promise<void> => {
    let sendCalls = 0;
    const service = new CommsService({
      mail: {
        id: "hook-mail",
        sendMail: async (): Promise<SendResult> => {
          sendCalls += 1;
          if (sendCalls === 1) {
            return {accepted: false, errorClass: "transient", errorCode: "429"};
          }
          return {accepted: true};
        },
      },
      onError: async (): Promise<never> => {
        throw new Error("onError boom");
      },
      onRetry: async (): Promise<never> => {
        throw new Error("onRetry boom");
      },
      onSend: async (): Promise<never> => {
        throw new Error("onSend boom");
      },
    });

    const result = await service.sendMail({subject: "Welcome", to: "person@example.com"});
    assert.isTrue(result.accepted);
    assert.equal(sendCalls, 2);
  });

  it("records delivery events and opt-outs without sending", async (): Promise<void> => {
    const deliveryEvents: string[] = [];
    const optOuts: string[] = [];
    const service = new CommsService({
      mail: {
        id: "hook-mail",
        sendMail: async (): Promise<SendResult> => ({
          accepted: true,
          providerMessageId: "mail-42",
        }),
      },
      onDeliveryEvent: async (event): Promise<void> => {
        deliveryEvents.push(event.status);
      },
      onOptOut: async (event): Promise<void> => {
        optOuts.push(event.reason);
      },
    });

    await service.sendMail({subject: "Welcome", to: "person@example.com"});
    await service.recordDeliveryEvent({
      channel: "mail",
      errorClass: "permanent",
      errorCode: "bounce",
      providerMessageId: "mail-42",
      status: "bounced",
    });
    await service.recordOptOut({
      channel: "mail",
      provider: "sendgrid",
      reason: "unsubscribe",
      to: "person@example.com",
    });
    await service.recordDeliveryEvent({
      channel: "mail",
      providerMessageId: "missing",
      status: "delivered",
    });

    const row = await CommsMessage.findExactlyOne({providerMessageId: "mail-42"});
    assert.equal(row.status, "bounced");
    assert.equal(row.errorCode, "bounce");
    assert.deepEqual(deliveryEvents, ["bounced", "delivered"]);
    assert.deepEqual(optOuts, ["unsubscribe"]);
  });

  it("does not change send or event outcome when intake hooks throw", async (): Promise<void> => {
    const service = new CommsService({
      onDeliveryEvent: async (): Promise<never> => {
        throw new Error("delivery boom");
      },
      onOptOut: async (): Promise<never> => {
        throw new Error("optOut boom");
      },
    });

    await service.recordDeliveryEvent({
      channel: "sms",
      providerMessageId: "none",
      status: "delivered",
    });
    await service.recordOptOut({
      channel: "sms",
      provider: "twilio",
      reason: "sms-stop",
      to: "+15555550100",
    });
  });

  it("retains redacted payloads and omits them when retention is disabled", async (): Promise<void> => {
    const userId = new mongoose.Types.ObjectId();
    await PushToken.upsert(
      {token: "ExponentPushToken[payload]"},
      {
        active: true,
        lastSeenAt: DateTime.utc().toJSDate(),
        platform: "ios",
        userId,
      }
    );
    const retained = new CommsService({
      mail: {
        id: "payload-mail",
        sendMail: async (): Promise<SendResult> => ({accepted: true}),
      },
      push: {
        id: "payload-push",
        sendPush: async (): Promise<SendResult[]> => [{accepted: true}],
      },
      redactPayload: (_context, payload): unknown => ({...(payload as object), redacted: true}),
      retainPayloadDays: 30,
      verification: {
        checkVerification: async (): Promise<{valid: boolean}> => ({valid: true}),
        id: "payload-verification",
        startVerification: async (): Promise<SendResult> => ({accepted: true}),
      },
    });
    const disabled = new CommsService({
      mail: {
        id: "disabled-mail",
        sendMail: async (): Promise<SendResult> => ({accepted: true}),
      },
      retainPayloadDays: 0,
    });

    await retained.sendMail({
      html: "<p>Hi</p>",
      subject: "Welcome",
      text: "Hi",
      to: "person@example.com",
    });
    await retained.sendPushToUser({body: "Hello", title: "Title", userId});
    await retained.startVerification({channel: "email", to: "person@example.com"});
    await disabled.sendMail({subject: "Nope", to: "person@example.com"});

    const mailRow = await CommsMessage.findExactlyOne({channel: "mail", provider: "payload-mail"});
    const pushRow = await CommsMessage.findExactlyOne({channel: "push"});
    const verificationRow = await CommsMessage.findExactlyOne({channel: "verification"});
    const disabledRow = await CommsMessage.findExactlyOne({provider: "disabled-mail"});

    assert.equal((mailRow.payload as {subject?: string}).subject, "Welcome");
    assert.equal((mailRow.payload as {redacted?: boolean}).redacted, true);
    assert.isUndefined((pushRow.payload as {tokens?: string[]}).tokens);
    assert.equal((pushRow.payload as {title?: string}).title, "Title");
    assert.deepEqual(verificationRow.payload, {channel: "email", redacted: true});
    assert.isUndefined(disabledRow.payload);
  });
});
