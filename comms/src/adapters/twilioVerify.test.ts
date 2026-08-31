import {describe, it} from "bun:test";
import {assert} from "chai";

import {type TwilioVerifyClient, TwilioVerifyProvider} from "./twilioVerify";

interface VerifyStartCall {
  channel: string;
  to: string;
}

interface VerifyCheckCall {
  code: string;
  to: string;
}

const createMockClient = ({
  checkStatus,
  startSid = "VE123",
  startStatus = "pending",
}: {
  checkStatus?: string;
  startSid?: string;
  startStatus?: string;
} = {}): TwilioVerifyClient & {checkCalls: VerifyCheckCall[]; startCalls: VerifyStartCall[]} => {
  const checkCalls: VerifyCheckCall[] = [];
  const startCalls: VerifyStartCall[] = [];
  return {
    checkCalls,
    startCalls,
    verify: {
      v2: {
        services: () => ({
          verificationChecks: {
            create: async (params: VerifyCheckCall): Promise<{status: string}> => {
              checkCalls.push(params);
              return {status: checkStatus ?? "approved"};
            },
          },
          verifications: {
            create: async (params: VerifyStartCall): Promise<{sid: string; status: string}> => {
              startCalls.push(params);
              return {sid: startSid, status: startStatus};
            },
          },
        }),
      },
    },
  };
};

const providerOptions = (
  client: TwilioVerifyClient
): ConstructorParameters<typeof TwilioVerifyProvider>[0] => ({
  accountSid: "ACtest",
  authToken: "token",
  client,
  verifyServiceSid: "VAservice",
});

describe("TwilioVerifyProvider", () => {
  it("fails fast when verify service SID is missing", (): void => {
    Reflect.deleteProperty(process.env, "TWILIO_VERIFY_SERVICE_SID");
    assert.throws(
      (): TwilioVerifyProvider =>
        new TwilioVerifyProvider({
          accountSid: "ACtest",
          authToken: "token",
          client: createMockClient(),
        }),
      /TWILIO_VERIFY_SERVICE_SID/
    );
  });

  it("fails fast when the twilio peer is not installed", (): void => {
    assert.throws(
      (): TwilioVerifyProvider =>
        new TwilioVerifyProvider({
          accountSid: "ACtest",
          authToken: "token",
          verifyServiceSid: "VAservice",
        }),
      /optional peer dependency twilio/
    );
  });

  it("starts SMS and email verifications on the configured service", async (): Promise<void> => {
    const client = createMockClient({startSid: "VEsms"});
    const provider = new TwilioVerifyProvider(providerOptions(client));

    const sms = await provider.startVerification({channel: "sms", to: "+14155552671"});
    const email = await provider.startVerification({
      channel: "email",
      to: "person@example.com",
    });

    assert.isTrue(sms.accepted);
    assert.equal(sms.providerMessageId, "VEsms");
    assert.isTrue(email.accepted);
    assert.deepEqual(
      client.startCalls.map((call) => call.channel),
      ["sms", "email"]
    );
  });

  it("returns valid true only for approved checks", async (): Promise<void> => {
    const approved = createMockClient({checkStatus: "approved"});
    const pending = createMockClient({checkStatus: "pending"});
    const expired = createMockClient({checkStatus: "expired"});
    const maxAttempts = createMockClient({checkStatus: "max_attempts_reached"});

    const approvedResult = await new TwilioVerifyProvider(
      providerOptions(approved)
    ).checkVerification({
      code: "123456",
      to: "+14155552671",
    });
    const pendingResult = await new TwilioVerifyProvider(
      providerOptions(pending)
    ).checkVerification({
      code: "123456",
      to: "+14155552671",
    });
    const expiredResult = await new TwilioVerifyProvider(
      providerOptions(expired)
    ).checkVerification({
      code: "123456",
      to: "+14155552671",
    });
    const maxResult = await new TwilioVerifyProvider(
      providerOptions(maxAttempts)
    ).checkVerification({
      code: "123456",
      to: "+14155552671",
    });

    assert.isTrue(approvedResult.valid);
    assert.isUndefined(approvedResult.error);
    assert.isFalse(pendingResult.valid);
    assert.equal(pendingResult.error, "pending");
    assert.isFalse(expiredResult.valid);
    assert.equal(expiredResult.error, "expired");
    assert.isFalse(maxResult.valid);
    assert.equal(maxResult.error, "max-attempts");
  });
});
