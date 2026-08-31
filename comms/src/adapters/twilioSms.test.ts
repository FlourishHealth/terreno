import {describe, it, spyOn} from "bun:test";
import {isAPIError, logger} from "@terreno/api";
import {assert} from "chai";

import {CommsService} from "../commsService";
import {CommsMessage} from "../models/commsMessage";
import {type TwilioSmsClient, TwilioSmsProvider} from "./twilioSms";

interface MockCreateCall {
  params: {
    body: string;
    from?: string;
    messagingServiceSid?: string;
    to: string;
  };
}

const createMockClient = (
  behavior?: (params: MockCreateCall["params"]) => Promise<{sid: string}>
): TwilioSmsClient & {calls: MockCreateCall[]} => {
  const calls: MockCreateCall[] = [];
  return {
    calls,
    messages: {
      create: async (params): Promise<{sid: string}> => {
        calls.push({params});
        if (behavior) {
          return behavior(params);
        }
        return {sid: "SM123"};
      },
    },
  };
};

const twilioRestError = ({
  code,
  message,
  status,
}: {
  code: number;
  message: string;
  status: number;
}): Error & {code: number; moreInfo: string; status: number} => {
  const error = new Error(message) as Error & {code: number; moreInfo: string; status: number};
  error.code = code;
  error.moreInfo = `https://www.twilio.com/docs/errors/${code}`;
  error.status = status;
  return error;
};

describe("TwilioSmsProvider", () => {
  it("fails fast when account SID or auth token is missing", (): void => {
    Reflect.deleteProperty(process.env, "TWILIO_ACCOUNT_SID");
    Reflect.deleteProperty(process.env, "TWILIO_AUTH_TOKEN");
    assert.throws(
      (): TwilioSmsProvider => new TwilioSmsProvider({client: createMockClient()}),
      /TWILIO_ACCOUNT_SID/
    );
  });

  it("fails fast when the twilio peer is not installed", (): void => {
    assert.throws(
      (): TwilioSmsProvider =>
        new TwilioSmsProvider({
          accountSid: "ACtest",
          authToken: "token",
        }),
      /optional peer dependency twilio/
    );
  });

  it("sends with messagingServiceSid when both senders are configured", async (): Promise<void> => {
    const client = createMockClient();
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
      fromNumber: "+15555550199",
      messagingServiceSid: "MGservice",
    });

    const result = await provider.sendSms({body: "Hello", to: "+14155552671"});

    assert.isTrue(result.accepted);
    assert.equal(result.providerMessageId, "SM123");
    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0]?.params.messagingServiceSid, "MGservice");
    assert.isUndefined(client.calls[0]?.params.from);
    assert.equal(client.calls[0]?.params.to, "+14155552671");
    assert.equal(client.calls[0]?.params.body, "Hello");
  });

  it("sends with fromNumber when no messaging service is configured", async (): Promise<void> => {
    const client = createMockClient();
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
      fromNumber: "+15555550199",
    });

    const result = await provider.sendSms({body: "Hello", to: "+14155552671"});

    assert.isTrue(result.accepted);
    assert.equal(client.calls[0]?.params.from, "+15555550199");
    assert.isUndefined(client.calls[0]?.params.messagingServiceSid);
  });

  it("prefers constructor sender options over env", async (): Promise<void> => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MGenv";
    process.env.TWILIO_FROM_NUMBER = "+15555550000";
    const client = createMockClient();
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
      fromNumber: "+15555550199",
      messagingServiceSid: "MGctor",
    });

    await provider.sendSms({body: "Hello", to: "+14155552671"});

    assert.equal(client.calls[0]?.params.messagingServiceSid, "MGctor");
  });

  it("reads credentials and messaging service from env", async (): Promise<void> => {
    process.env.TWILIO_ACCOUNT_SID = "ACenv";
    process.env.TWILIO_AUTH_TOKEN = "env-token";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MGenv";
    const client = createMockClient();
    const provider = new TwilioSmsProvider({client});

    await provider.sendSms({body: "Hello", to: "+14155552671"});

    assert.equal(client.calls[0]?.params.messagingServiceSid, "MGenv");
  });

  it("returns a config failure when no sender is configured", async (): Promise<void> => {
    const client = createMockClient();
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
    });

    const result = await provider.sendSms({body: "Hello", to: "+14155552671"});

    assert.isFalse(result.accepted);
    assert.equal(result.errorClass, "config");
    assert.equal(result.errorCode, "twilio-missing-sender");
    assert.equal(client.calls.length, 0);
  });

  it("rejects a non-E.164 destination with a 400 before calling Twilio", async (): Promise<void> => {
    const client = createMockClient();
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
      messagingServiceSid: "MGservice",
    });

    try {
      await provider.sendSms({body: "Hello", to: "not-a-phone"});
      assert.fail("expected BadRequestError");
    } catch (error: unknown) {
      assert.isTrue(isAPIError(error));
      assert.equal((error as {status: number}).status, 400);
    }
    assert.equal(client.calls.length, 0);
  });

  it("normalizes a valid destination to E.164 before calling Twilio", async (): Promise<void> => {
    const client = createMockClient();
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
      messagingServiceSid: "MGservice",
    });

    await provider.sendSms({body: "Hello", to: "+1 (415) 555-2671"});

    assert.equal(client.calls[0]?.params.to, "+14155552671");
  });

  it("classifies 21610 as permanent and never retries", async (): Promise<void> => {
    let attempts = 0;
    const client = createMockClient(async () => {
      attempts += 1;
      throw twilioRestError({
        code: 21610,
        message: "Attempt to send to unsubscribed recipient",
        status: 400,
      });
    });
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
      messagingServiceSid: "MGservice",
    });
    const service = new CommsService({sms: provider});

    const result = await service.sendSms({body: "Hello", to: "+14155552671"});

    assert.isFalse(result.accepted);
    assert.equal(result.errorClass, "permanent");
    assert.equal(result.errorCode, "21610");
    assert.isTrue(result.isPermanentFailure);
    assert.equal(attempts, 1);
    const row = await CommsMessage.findExactlyOne({_id: result.loggedMessageId});
    assert.equal((row.metadata as {twilioError?: {code?: number}})?.twilioError?.code, 21610);
  });

  it("classifies 20429 as transient so the facade retries once", async (): Promise<void> => {
    let attempts = 0;
    const client = createMockClient(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw twilioRestError({
          code: 20429,
          message: "Too many requests",
          status: 429,
        });
      }
      return {sid: "SM-retry-ok"};
    });
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
      messagingServiceSid: "MGservice",
    });
    const service = new CommsService({sms: provider});

    const result = await service.sendSms({body: "Hello", to: "+14155552671"});

    assert.isTrue(result.accepted);
    assert.equal(attempts, 2);
  });

  it("classifies 20003 as config and logs an error", async (): Promise<void> => {
    const errorSpy = spyOn(logger, "error").mockImplementation(() => undefined);
    try {
      const client = createMockClient(async () => {
        throw twilioRestError({
          code: 20003,
          message: "Authenticate",
          status: 401,
        });
      });
      const provider = new TwilioSmsProvider({
        accountSid: "ACtest",
        authToken: "token",
        client,
        messagingServiceSid: "MGservice",
      });

      const result = await provider.sendSms({body: "Hello", to: "+14155552671"});

      assert.isFalse(result.accepted);
      assert.equal(result.errorClass, "config");
      assert.equal(result.errorCode, "20003");
      assert.isTrue(errorSpy.mock.calls.some((call) => String(call[0]).includes("20003")));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("classifies unknown Twilio codes as transient", async (): Promise<void> => {
    const client = createMockClient(async () => {
      throw twilioRestError({
        code: 99999,
        message: "Mystery",
        status: 400,
      });
    });
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
      messagingServiceSid: "MGservice",
    });

    const result = await provider.sendSms({body: "Hello", to: "+14155552671"});

    assert.isFalse(result.accepted);
    assert.equal(result.errorClass, "transient");
    assert.equal(result.errorCode, "99999");
  });
});
