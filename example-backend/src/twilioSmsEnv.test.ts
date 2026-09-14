import {describe, it} from "bun:test";
import {assert} from "chai";

import {resolveTwilioSmsEnvConfig} from "./twilioSmsEnv";

describe("resolveTwilioSmsEnvConfig", () => {
  it("returns undefined when Twilio SMS is unconfigured", (): void => {
    assert.isUndefined(
      resolveTwilioSmsEnvConfig({
        NODE_ENV: "test",
      })
    );
  });

  it("fails fast when a sender is set without complete credentials", (): void => {
    assert.throws((): void => {
      resolveTwilioSmsEnvConfig({
        TWILIO_ACCOUNT_SID: "ACtest",
        TWILIO_MESSAGING_SERVICE_SID: "MGservice",
      });
    }, /TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER/);
  });

  it("skips SMS when account credentials are present without a sender", (): void => {
    assert.isUndefined(
      resolveTwilioSmsEnvConfig({
        TWILIO_ACCOUNT_SID: "ACtest",
        TWILIO_AUTH_TOKEN: "token",
      })
    );
  });

  it("skips SMS for Verify-only env (shared creds, no sender)", (): void => {
    assert.isUndefined(
      resolveTwilioSmsEnvConfig({
        TWILIO_ACCOUNT_SID: "ACtest",
        TWILIO_AUTH_TOKEN: "token",
        TWILIO_VERIFY_SERVICE_SID: "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      })
    );
  });

  it("prefers messaging service SID when both senders are set", (): void => {
    const config = resolveTwilioSmsEnvConfig({
      TWILIO_ACCOUNT_SID: "ACtest",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_FROM_NUMBER: "+14155552671",
      TWILIO_MESSAGING_SERVICE_SID: "MGservice",
    });

    assert.deepEqual(config, {
      accountSid: "ACtest",
      authToken: "token",
      fromNumber: "+14155552671",
      messagingServiceSid: "MGservice",
    });
  });
});
