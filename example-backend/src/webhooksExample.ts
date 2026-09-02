import {hmacSignature, logger, WebhooksApp} from "@terreno/api";
import type {Request} from "express";

const EXAMPLE_WEBHOOK_PATH = "/webhooks/example";

/**
 * Builds the example inbound `WebhooksApp`. HMAC `POST /webhooks/example` is registered
 * only when `WEBHOOK_SECRET` is set. The framework does not read that env itself.
 */
export const createExampleInboundWebhooks = (): WebhooksApp => {
  const webhooks = new WebhooksApp({idempotency: {store: "memory"}});
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return webhooks;
  }

  webhooks.route({
    eventId: (req: Request): string => String((req.body as {id?: string} | undefined)?.id ?? ""),
    handler: async ({eventId}): Promise<void> => {
      logger.info(`[Webhook] received example event ${eventId || "none"}`);
    },
    path: EXAMPLE_WEBHOOK_PATH,
    source: "example",
    verify: hmacSignature({header: "X-Webhook-Signature", secret}),
  });
  return webhooks;
};
