import {logger, sendgridEventSignature, type WebhooksApp} from "@terreno/api";

import {SendGridMailProvider} from "../adapters/sendgrid";
import type {CommsService} from "../commsService";
import {CommsMessage} from "../models/commsMessage";
import type {OptOutEvent} from "../types";

const eventString = (value: unknown): string => {
  return typeof value === "string" ? value : "";
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const storedProviderMessageId = async (sgMessageId: string): Promise<string> => {
  const prefix = sgMessageId.split(".")[0] ?? sgMessageId;
  if (!prefix) {
    return sgMessageId;
  }
  const exact = await CommsMessage.findOneOrNone({providerMessageId: prefix});
  if (exact?.providerMessageId) {
    return exact.providerMessageId;
  }
  const prefixed = await CommsMessage.findOneOrNone({
    providerMessageId: new RegExp(`^${escapeRegex(prefix)}`),
  });
  return prefixed?.providerMessageId ?? prefix;
};

const applySendGridEvent = async ({
  event,
  service,
}: {
  event: Record<string, unknown>;
  service: CommsService;
}): Promise<void> => {
  const type = eventString(event.event);
  const providerMessageId = await storedProviderMessageId(eventString(event.sg_message_id));
  const reason = eventString(event.reason);
  const email = eventString(event.email);

  if (type === "delivered") {
    await service.recordDeliveryEvent({
      channel: "mail",
      providerMessageId,
      raw: event,
      status: "delivered",
    });
    return;
  }
  if (type === "open") {
    await service.recordDeliveryEvent({
      channel: "mail",
      providerMessageId,
      raw: event,
      status: "opened",
    });
    return;
  }
  if (type === "bounce") {
    const isSoft = eventString(event.type) === "blocked";
    await service.recordDeliveryEvent({
      channel: "mail",
      errorClass: isSoft ? "transient" : "permanent",
      errorCode: reason || (isSoft ? "deferred" : "bounce"),
      providerMessageId,
      raw: event,
      status: "bounced",
    });
    return;
  }
  if (type === "dropped") {
    await service.recordDeliveryEvent({
      channel: "mail",
      errorClass: "permanent",
      errorCode: reason || "dropped",
      providerMessageId,
      raw: event,
      status: "failed",
    });
    return;
  }
  if (type === "spamreport" || type === "unsubscribe" || type === "group_unsubscribe") {
    const optOut: OptOutEvent = {
      channel: "mail",
      provider: "sendgrid",
      raw: event,
      reason: type,
      to: email,
    };
    await service.recordOptOut(optOut);
  }
};

export const registerSendGridCommsWebhooks = ({
  basePath,
  publicKey,
  service,
  webhooks,
}: {
  basePath: string;
  publicKey: string;
  service: CommsService;
  webhooks: WebhooksApp;
}): void => {
  webhooks.route({
    handler: async ({body}): Promise<void> => {
      if (!Array.isArray(body)) {
        return;
      }
      for (const item of body) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          continue;
        }
        const event = item as Record<string, unknown>;
        const eventId = eventString(event.sg_event_id);
        if (!eventId) {
          continue;
        }
        const claimResult = await webhooks.claim({eventId, source: "sendgrid"});
        if (claimResult === "duplicate") {
          continue;
        }
        try {
          await applySendGridEvent({event, service});
        } catch (error) {
          await webhooks.release({eventId, source: "sendgrid"});
          throw error;
        }
      }
    },
    path: `${basePath}/webhooks/sendgrid`,
    source: "sendgrid",
    verify: sendgridEventSignature({publicKey}),
  });
};

export const maybeRegisterSendGridCommsWebhooks = ({
  basePath,
  mail,
  service,
  webhooks,
}: {
  basePath: string;
  mail?: {id: string};
  service: CommsService;
  webhooks?: WebhooksApp;
}): void => {
  if (!webhooks || !(mail instanceof SendGridMailProvider)) {
    return;
  }
  const publicKey = mail.getWebhookVerificationKey();
  if (!publicKey) {
    logger.error(
      "[comms] Skipping SendGrid webhook routes; set webhookVerificationKey or SENDGRID_WEBHOOK_VERIFICATION_KEY"
    );
    return;
  }
  registerSendGridCommsWebhooks({
    basePath,
    publicKey,
    service,
    webhooks,
  });
};
