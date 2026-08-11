import {afterEach, describe, it} from "bun:test";
import {assert} from "chai";

import {CommsService} from "../commsService";

describe("CommsService", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach((): void => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("uses configured providers and records every attempt", async (): Promise<void> => {
    const logged: Array<Record<string, unknown>> = [];
    const service = new CommsService({
      defaultFrom: "noreply@example.com",
      logSend: async (entry): Promise<void> => {
        logged.push(entry);
      },
      mail: {
        id: "sendgrid",
        sendMail: async (message) => ({
          accepted: message.from === "noreply@example.com",
          providerMessageId: "mail-1",
        }),
      },
      sms: {
        id: "twilio",
        sendSms: async () => ({accepted: true, providerMessageId: "sms-1"}),
      },
    });

    const mail = await service.sendMail({
      subject: "Welcome",
      text: "Hello",
      to: "person@example.com",
    });
    const sms = await service.sendSms({body: "Hello", to: "+15555550100"});

    assert.isTrue(mail.accepted);
    assert.isTrue(sms.accepted);
    assert.deepInclude(logged[0], {
      channel: "mail",
      provider: "sendgrid",
      providerMessageId: "mail-1",
      status: "sent",
    });
    assert.deepInclude(logged[1], {
      channel: "sms",
      provider: "twilio",
      providerMessageId: "sms-1",
      status: "sent",
    });
  });

  it("falls back to console providers outside production", async (): Promise<void> => {
    process.env.NODE_ENV = "development";
    const service = new CommsService({logMessages: false});

    const result = await service.sendMail({
      subject: "Development",
      text: "No external account required",
      to: "person@example.com",
    });

    assert.isTrue(result.accepted);
  });

  it("fails with a 501 APIError for unconfigured production channels", async (): Promise<void> => {
    process.env.NODE_ENV = "production";
    const service = new CommsService({logMessages: false});

    try {
      await service.sendSms({body: "Hello", to: "+15555550100"});
      assert.fail("Expected sendSms to reject");
    } catch (error) {
      assert.deepInclude(error as Record<string, unknown>, {
        status: 501,
        title: "Comms channel not configured",
      });
    }
  });

  it("logs rejected provider results without throwing them away", async (): Promise<void> => {
    const logged: Array<Record<string, unknown>> = [];
    const service = new CommsService({
      logSend: async (entry): Promise<void> => {
        logged.push(entry);
      },
      mail: {
        id: "sendgrid",
        sendMail: async () => ({accepted: false, error: "Sender is not verified"}),
      },
    });

    const result = await service.sendMail({
      subject: "Welcome",
      to: "person@example.com",
    });

    assert.isFalse(result.accepted);
    assert.deepInclude(logged[0], {
      error: "Sender is not verified",
      status: "failed",
    });
  });
});
