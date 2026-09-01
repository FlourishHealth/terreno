import {logger, twilioSignature, type WebhooksApp} from "@terreno/api";
import type {Request} from "express";

import {TwilioSmsProvider} from "../adapters/twilioSms";
import type {CommsService} from "../commsService";
import type {DeliveryEvent} from "../types";

const formString = (body: unknown, key: string): string => {
  if (!body || typeof body !== "object") {
    return "";
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
};

const inboundKeyword = (body: string): "sms-start" | "sms-stop" | undefined => {
  const keyword = body.trim().split(/\s+/)[0]?.toUpperCase();
  if (keyword === "STOP") {
    return "sms-stop";
  }
  if (keyword === "START") {
    return "sms-start";
  }
  return undefined;
};

const mapStatus = (
  messageStatus: string,
  errorCode: string
): Pick<DeliveryEvent, "errorClass" | "errorCode" | "status"> | undefined => {
  if (messageStatus === "delivered") {
    return {status: "delivered"};
  }
  if (messageStatus === "undelivered" || messageStatus === "failed") {
    return {
      errorClass: errorCode === "21610" ? "permanent" : "transient",
      errorCode: errorCode || undefined,
      status: "failed",
    };
  }
  return undefined;
};

export const registerTwilioCommsWebhooks = ({
  authToken,
  basePath,
  publicUrl,
  service,
  webhooks,
}: {
  authToken: string;
  basePath: string;
  publicUrl: string;
  service: CommsService;
  webhooks: WebhooksApp;
}): void => {
  const statusPath = `${basePath}/webhooks/twilio/status`;
  const inboundPath = `${basePath}/webhooks/twilio/inbound`;
  const statusUrl = `${publicUrl}${statusPath}`;
  const inboundUrl = `${publicUrl}${inboundPath}`;

  webhooks.route({
    eventId: (req: Request): string => formString(req.body, "MessageSid"),
    handler: async ({body}): Promise<void> => {
      const messageStatus = formString(body, "MessageStatus");
      const mapped = mapStatus(messageStatus, formString(body, "ErrorCode"));
      if (!mapped) {
        return;
      }
      await service.recordDeliveryEvent({
        channel: "sms",
        errorClass: mapped.errorClass,
        errorCode: mapped.errorCode,
        providerMessageId: formString(body, "MessageSid"),
        raw: body,
        status: mapped.status,
      });
    },
    path: statusPath,
    source: "twilio-status",
    verify: twilioSignature({authToken, url: statusUrl}),
  });

  webhooks.route({
    eventId: (req: Request): string => {
      const sid = formString(req.body, "SmsSid") || formString(req.body, "MessageSid");
      const keyword = inboundKeyword(formString(req.body, "Body")) ?? "inbound";
      return `${sid}:${keyword}`;
    },
    handler: async ({body}): Promise<void> => {
      const reason = inboundKeyword(formString(body, "Body"));
      if (!reason) {
        return;
      }
      await service.recordOptOut({
        channel: "sms",
        provider: "twilio",
        raw: body,
        reason,
        to: formString(body, "From"),
      });
    },
    path: inboundPath,
    source: "twilio-inbound",
    verify: twilioSignature({authToken, url: inboundUrl}),
  });
};

export const maybeRegisterTwilioCommsWebhooks = ({
  basePath,
  publicUrl,
  service,
  sms,
  webhooks,
}: {
  basePath: string;
  publicUrl?: string;
  service: CommsService;
  sms?: {id: string};
  webhooks?: WebhooksApp;
}): void => {
  if (!webhooks || !(sms instanceof TwilioSmsProvider)) {
    return;
  }
  const authToken = sms.getAuthToken();
  if (!authToken) {
    logger.error("[comms] Skipping Twilio webhook routes; auth token is missing");
    return;
  }
  const resolvedPublicUrl = (
    publicUrl ??
    process.env.PUBLIC_API_URL ??
    process.env.COMMS_WEBHOOK_PUBLIC_URL ??
    ""
  ).replace(/\/$/, "");
  if (!resolvedPublicUrl) {
    logger.error(
      "[comms] Skipping Twilio webhook routes; set webhookPublicUrl, PUBLIC_API_URL, or COMMS_WEBHOOK_PUBLIC_URL"
    );
    return;
  }
  sms.applyDefaultStatusCallbackUrl(`${resolvedPublicUrl}${basePath}/webhooks/twilio/status`);
  registerTwilioCommsWebhooks({
    authToken,
    basePath,
    publicUrl: resolvedPublicUrl,
    service,
    webhooks,
  });
};
