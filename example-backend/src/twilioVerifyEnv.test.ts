import {describe, it} from "bun:test";
import {assert} from "chai";

import {resolveTwilioSmsEnvConfig} from "./twilioSmsEnv";
import {resolveTwilioVerifyEnvConfig} from "./twilioVerifyEnv";

describe("resolveTwilioVerifyEnvConfig", () => {
  it("returns undefined when TWILIO_VERIFY_SERVICE_SID is unset", () => {
    assert.isUndefined(
      resolveTwilioVerifyEnvConfig({
        TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        TWILIO_AUTH_TOKEN: "auth-token",
      })
    );
  });

  it("throws when TWILIO_VERIFY_SERVICE_SID is set without account credentials", () => {
    assert.throws(
      () =>
        resolveTwilioVerifyEnvConfig({
          TWILIO_VERIFY_SERVICE_SID: "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        }),
      /TWILIO_VERIFY_SERVICE_SID is set; also set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN/
    );
  });

  it("throws when TWILIO_VERIFY_SERVICE_SID is set with only the account SID", () => {
    assert.throws(
      () =>
        resolveTwilioVerifyEnvConfig({
          TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          TWILIO_VERIFY_SERVICE_SID: "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        }),
      /TWILIO_VERIFY_SERVICE_SID is set; also set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN/
    );
  });

  it("returns config when verify service SID and account credentials are set", () => {
    assert.deepEqual(
      resolveTwilioVerifyEnvConfig({
        TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        TWILIO_AUTH_TOKEN: "auth-token",
        TWILIO_VERIFY_SERVICE_SID: "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      }),
      {
        accountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        authToken: "auth-token",
        verifyServiceSid: "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      }
    );
  });

  it("registers Verify without requiring an SMS sender", () => {
    const env = {
      TWILIO_ACCOUNT_SID: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      TWILIO_AUTH_TOKEN: "auth-token",
      TWILIO_VERIFY_SERVICE_SID: "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    };
    assert.isUndefined(resolveTwilioSmsEnvConfig(env));
    assert.deepEqual(resolveTwilioVerifyEnvConfig(env), {
      accountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      authToken: "auth-token",
      verifyServiceSid: "VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
  });
});
