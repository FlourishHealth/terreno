import {describe, it, spyOn} from "bun:test";
import {logger} from "@terreno/api";
import {assert} from "chai";

import {CommsService} from "../commsService";
import type {SendResult} from "../types";
import {SendGridMailProvider} from "./sendgrid";

interface MockClientCall {
  message: Record<string, unknown>;
}

const createMockClient = (
  behavior: (message: Record<string, unknown>) => Promise<
    [
      {
        body?: unknown;
        headers?: Record<string, string | string[] | undefined>;
        statusCode?: number;
      },
      Record<string, unknown>,
    ]
  >
): {
  calls: MockClientCall[];
  send: (message: Record<string, unknown>) => Promise<
    [
      {
        body?: unknown;
        headers?: Record<string, string | string[] | undefined>;
        statusCode?: number;
      },
      Record<string, unknown>,
    ]
  >;
} => {
  const calls: MockClientCall[] = [];
  return {
    calls,
    send: async (message: Record<string, unknown>) => {
      calls.push({message});
      return behavior(message);
    },
  };
};

const sendGridError = ({
  body,
  statusCode,
}: {
  body: unknown;
  statusCode: number;
}): Error & {code: number; response: {body: unknown; statusCode: number}} => {
  const error = new Error(`SendGrid status ${statusCode}`) as Error & {
    code: number;
    response: {body: unknown; statusCode: number};
  };
  error.code = statusCode;
  error.response = {body, statusCode};
  return error;
};

describe("SendGridMailProvider", () => {
  it("fails fast when no API key is configured", (): void => {
    Reflect.deleteProperty(process.env, "SENDGRID_API_KEY");
    assert.throws(
      (): SendGridMailProvider => new SendGridMailProvider(),
      /SENDGRID_API_KEY or an apiKey constructor option/
    );
  });

  it("sends text and html mail with from-address fallback and sandbox mode under test", async (): Promise<void> => {
    const client = createMockClient(async () => [
      {
        headers: {"x-message-id": "sg-msg-1"},
        statusCode: 202,
      },
      {},
    ]);
    const provider = new SendGridMailProvider({
      apiKey: "sg-test-key",
      client,
      fromEmail: "noreply@example.com",
      fromName: "Terreno",
    });

    const result = await provider.sendMail({
      html: "<p>Hello</p>",
      subject: "Welcome",
      text: "Hello",
      to: "person@example.com",
    });

    assert.isTrue(result.accepted);
    assert.equal(result.providerMessageId, "sg-msg-1");
    assert.include(String(result.metadata?.consoleUrl), "sg-msg-1");
    assert.equal(client.calls.length, 1);
    assert.deepEqual(client.calls[0]?.message.from, {
      email: "noreply@example.com",
      name: "Terreno",
    });
    assert.equal(client.calls[0]?.message.html, "<p>Hello</p>");
    assert.equal(client.calls[0]?.message.text, "Hello");
    assert.deepEqual(client.calls[0]?.message.mailSettings, {
      sandboxMode: {enable: true},
    });
  });

  it("passes templateId and dynamicTemplateData through to SendGrid", async (): Promise<void> => {
    const client = createMockClient(async () => [
      {headers: {"x-message-id": "sg-tmpl-1"}, statusCode: 202},
      {},
    ]);
    const provider = new SendGridMailProvider({
      apiKey: "sg-test-key",
      client,
      fromEmail: "noreply@example.com",
      sandboxMode: false,
    });

    await provider.sendMail({
      dynamicTemplateData: {name: "Ada"},
      subject: "Welcome",
      templateId: "d-template-123",
      to: ["a@example.com", "b@example.com"],
    });

    assert.equal(client.calls[0]?.message.templateId, "d-template-123");
    assert.deepEqual(client.calls[0]?.message.dynamicTemplateData, {name: "Ada"});
    assert.isUndefined(client.calls[0]?.message.mailSettings);
  });

  it("classifies bad address as permanent and never throws", async (): Promise<void> => {
    const client = createMockClient(async () => {
      throw sendGridError({
        body: {errors: [{message: "The to address is invalid"}]},
        statusCode: 400,
      });
    });
    const provider = new SendGridMailProvider({
      apiKey: "sg-test-key",
      client,
      fromEmail: "noreply@example.com",
    });

    const result = await provider.sendMail({
      subject: "Welcome",
      text: "Hello",
      to: "not-an-email",
    });

    assert.isFalse(result.accepted);
    assert.equal(result.error, "The to address is invalid");
    assert.equal(result.errorCode, "sendgrid-400");
    assert.equal(result.errorClass, "permanent");
    assert.isTrue(result.isPermanentFailure);
  });

  it("classifies 401/403 as config and logs an error", async (): Promise<void> => {
    const errorSpy = spyOn(logger, "error").mockImplementation(() => undefined);
    try {
      const client = createMockClient(async () => {
        throw sendGridError({
          body: {errors: [{message: "Unauthorized"}]},
          statusCode: 401,
        });
      });
      const provider = new SendGridMailProvider({
        apiKey: "bad-key",
        client,
        fromEmail: "noreply@example.com",
      });

      const result = await provider.sendMail({
        subject: "Welcome",
        text: "Hello",
        to: "person@example.com",
      });

      assert.isFalse(result.accepted);
      assert.equal(result.errorClass, "config");
      assert.equal(result.errorCode, "sendgrid-401");
      assert.isTrue(errorSpy.mock.calls.some((call) => String(call[0]).includes("sendgrid-401")));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("classifies 429 as transient so the facade retries once", async (): Promise<void> => {
    let attempts = 0;
    const client = createMockClient(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw sendGridError({
          body: {errors: [{message: "Too Many Requests"}]},
          statusCode: 429,
        });
      }
      return [{headers: {"x-message-id": "sg-retry-ok"}, statusCode: 202}, {}];
    });
    const provider = new SendGridMailProvider({
      apiKey: "sg-test-key",
      client,
      fromEmail: "noreply@example.com",
    });
    const onErrorCalls: SendResult[] = [];
    const onRetryCalls: SendResult[] = [];
    const service = new CommsService({
      mail: provider,
      onError: async (_context, result): Promise<void> => {
        onErrorCalls.push(result);
      },
      onRetry: async (_context, result): Promise<void> => {
        onRetryCalls.push(result);
      },
    });

    const result = await service.sendMail({
      subject: "Welcome",
      text: "Hello",
      to: "person@example.com",
    });

    assert.isTrue(result.accepted);
    assert.equal(attempts, 2);
    assert.equal(onRetryCalls.length, 1);
    assert.equal(onRetryCalls[0]?.errorClass, "transient");
    assert.equal(onErrorCalls.length, 0);
  });

  it("fires onError with the classified result when the send finally fails", async (): Promise<void> => {
    const client = createMockClient(async () => {
      throw sendGridError({
        body: {errors: [{message: "The to address is invalid"}]},
        statusCode: 400,
      });
    });
    const provider = new SendGridMailProvider({
      apiKey: "sg-test-key",
      client,
      fromEmail: "noreply@example.com",
    });
    const onErrorCalls: SendResult[] = [];
    const service = new CommsService({
      mail: provider,
      onError: async (_context, result): Promise<void> => {
        onErrorCalls.push(result);
      },
    });

    const result = await service.sendMail({
      subject: "Welcome",
      text: "Hello",
      to: "not-an-email",
    });

    assert.isFalse(result.accepted);
    assert.equal(onErrorCalls.length, 1);
    assert.equal(onErrorCalls[0]?.errorClass, "permanent");
    assert.equal(onErrorCalls[0]?.errorCode, "sendgrid-400");
  });

  it("uses MailMessage.from when constructor fromEmail is omitted", async (): Promise<void> => {
    const client = createMockClient(async () => [
      {headers: {"x-message-id": "sg-from-msg"}, statusCode: 202},
      {},
    ]);
    const provider = new SendGridMailProvider({
      apiKey: "sg-test-key",
      client,
    });

    await provider.sendMail({
      from: "fallback@example.com",
      subject: "Welcome",
      text: "Hello",
      to: "person@example.com",
    });

    assert.equal(client.calls[0]?.message.from, "fallback@example.com");
  });
});
