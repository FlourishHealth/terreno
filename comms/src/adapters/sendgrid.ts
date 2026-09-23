import {createRequire} from "node:module";
import {logger} from "@terreno/api";

import type {CommsErrorClass, MailMessage, MailProvider, SendResult} from "../types";

const nodeRequire = createRequire(__filename);

interface SendGridResponse {
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  statusCode?: number;
}

interface SendGridClient {
  send: (message: Record<string, unknown>) => Promise<[SendGridResponse, Record<string, unknown>]>;
}

interface SendGridMailModule {
  send: SendGridClient["send"];
  setApiKey: (apiKey: string) => void;
}

export interface SendGridMailProviderOptions {
  apiKey?: string;
  /** Injected client for tests. Production wiring loads `@sendgrid/mail`. */
  client?: SendGridClient;
  fromEmail?: string;
  fromName?: string;
  sandboxMode?: boolean;
  webhookVerificationKey?: string;
}

const EMAIL_ACTIVITY_BASE = "https://app.sendgrid.com/email_activity";

const resolveApiKey = (options?: SendGridMailProviderOptions): string => {
  const apiKey = options?.apiKey ?? process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SendGridMailProvider requires SENDGRID_API_KEY or an apiKey constructor option"
    );
  }
  return apiKey;
};

const loadSendGridMail = (): SendGridMailModule => {
  try {
    // Optional peer — keep `@sendgrid/mail` out of core dependencies.
    return nodeRequire("@sendgrid/mail") as SendGridMailModule;
  } catch {
    throw new Error(
      "SendGridMailProvider requires optional peer dependency @sendgrid/mail. " +
        "Install it with: bun add @sendgrid/mail"
    );
  }
};

const headerValue = (
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string | undefined => {
  if (!headers) {
    return undefined;
  }
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const emailActivityUrl = (messageId: string): string => {
  const filters = encodeURIComponent(
    JSON.stringify([
      {
        comparisonType: "Contains",
        selectedFieldName: "msg_id",
        val: [messageId],
      },
    ])
  );
  return `${EMAIL_ACTIVITY_BASE}?filters=${filters}`;
};

const firstSendGridErrorMessage = (body: unknown): string | undefined => {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const errors = (body as {errors?: Array<{message?: string}>}).errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined;
  }
  return errors[0]?.message;
};

const classifyHttpStatus = (
  statusCode: number
): {errorClass: CommsErrorClass; errorCode: string} => {
  if (statusCode === 401 || statusCode === 403) {
    return {errorClass: "config", errorCode: `sendgrid-${statusCode}`};
  }
  if (statusCode === 429 || statusCode >= 500) {
    return {errorClass: "transient", errorCode: `sendgrid-${statusCode}`};
  }
  return {errorClass: "permanent", errorCode: `sendgrid-${statusCode}`};
};

const failedResult = ({
  body,
  error,
  errorClass,
  errorCode,
}: {
  body?: unknown;
  error: string;
  errorClass: CommsErrorClass;
  errorCode: string;
}): SendResult => {
  if (errorClass === "config") {
    logger.error(`[comms:sendgrid] ${errorCode}: ${error}`);
  }
  return {
    accepted: false,
    error,
    errorClass,
    errorCode,
    isPermanentFailure: errorClass === "permanent",
    metadata: body === undefined ? undefined : {sendGridResponse: body},
  };
};

const statusFromError = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const withCode = error as {code?: unknown; response?: {statusCode?: unknown}};
  const responseStatus = withCode.response?.statusCode;
  if (typeof responseStatus === "number") {
    return responseStatus;
  }
  if (typeof withCode.code === "number") {
    return withCode.code;
  }
  return undefined;
};

const bodyFromError = (error: unknown): unknown => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  return (error as {response?: {body?: unknown}}).response?.body;
};

export class SendGridMailProvider implements MailProvider {
  readonly id = "sendgrid";
  private readonly client: SendGridClient;
  private readonly fromEmail?: string;
  private readonly fromName?: string;
  private readonly sandboxMode: boolean;
  private readonly webhookVerificationKey?: string;

  constructor(options?: SendGridMailProviderOptions) {
    const apiKey = resolveApiKey(options);
    this.fromEmail = options?.fromEmail;
    this.fromName = options?.fromName;
    this.sandboxMode = options?.sandboxMode ?? process.env.NODE_ENV === "test";
    this.webhookVerificationKey =
      options?.webhookVerificationKey ?? process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

    if (options?.client) {
      this.client = options.client;
      return;
    }

    const sgMail = loadSendGridMail();
    sgMail.setApiKey(apiKey);
    this.client = sgMail;
  }

  getWebhookVerificationKey = (): string | undefined => {
    return this.webhookVerificationKey;
  };

  async sendMail(message: MailMessage): Promise<SendResult> {
    const fromEmail = this.fromEmail ?? message.from;
    if (!fromEmail) {
      return failedResult({
        error: "SendGridMailProvider requires fromEmail or MailMessage.from",
        errorClass: "config",
        errorCode: "sendgrid-missing-from",
      });
    }

    const payload: Record<string, unknown> = {
      from: this.fromName ? {email: fromEmail, name: this.fromName} : fromEmail,
      subject: message.subject,
      to: message.to,
      ...(message.html ? {html: message.html} : {}),
      ...(message.text ? {text: message.text} : {}),
      ...(message.replyTo ? {replyTo: message.replyTo} : {}),
      ...(message.templateId
        ? {
            dynamicTemplateData: message.dynamicTemplateData ?? {},
            templateId: message.templateId,
          }
        : {}),
      ...(this.sandboxMode ? {mailSettings: {sandboxMode: {enable: true}}} : {}),
    };

    try {
      const [response] = await this.client.send(payload);
      const providerMessageId = headerValue(response.headers, "x-message-id");
      return {
        accepted: true,
        metadata: providerMessageId ? {consoleUrl: emailActivityUrl(providerMessageId)} : undefined,
        providerMessageId,
      };
    } catch (error: unknown) {
      const statusCode = statusFromError(error) ?? 500;
      const body = bodyFromError(error);
      const {errorClass, errorCode} = classifyHttpStatus(statusCode);
      const errorMessage =
        firstSendGridErrorMessage(body) ??
        (error instanceof Error ? error.message : "SendGrid send failed");
      return failedResult({
        body,
        error: errorMessage,
        errorClass,
        errorCode,
      });
    }
  }
}
