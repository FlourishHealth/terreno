import {describe, it} from "bun:test";
import {assert} from "chai";

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

    const result = await provider.sendSms({body: "Hello", to: "+15555550100"});

    assert.isTrue(result.accepted);
    assert.equal(result.providerMessageId, "SM123");
    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0]?.params.messagingServiceSid, "MGservice");
    assert.isUndefined(client.calls[0]?.params.from);
    assert.equal(client.calls[0]?.params.to, "+15555550100");
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

    const result = await provider.sendSms({body: "Hello", to: "+15555550100"});

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

    await provider.sendSms({body: "Hello", to: "+15555550100"});

    assert.equal(client.calls[0]?.params.messagingServiceSid, "MGctor");
  });

  it("reads credentials and messaging service from env", async (): Promise<void> => {
    process.env.TWILIO_ACCOUNT_SID = "ACenv";
    process.env.TWILIO_AUTH_TOKEN = "env-token";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MGenv";
    const client = createMockClient();
    const provider = new TwilioSmsProvider({client});

    await provider.sendSms({body: "Hello", to: "+15555550100"});

    assert.equal(client.calls[0]?.params.messagingServiceSid, "MGenv");
  });

  it("returns a config failure when no sender is configured", async (): Promise<void> => {
    const client = createMockClient();
    const provider = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: "token",
      client,
    });

    const result = await provider.sendSms({body: "Hello", to: "+15555550100"});

    assert.isFalse(result.accepted);
    assert.equal(result.errorClass, "config");
    assert.equal(result.errorCode, "twilio-missing-sender");
    assert.equal(client.calls.length, 0);
  });
});
