import type {IncomingHttpHeaders} from "node:http";
import type {Application, Request, Response} from "express";

import {asyncHandler} from "../api";
import {APIError, isAPIError} from "../errors";
import {createScopedLogger} from "../logger";

import type {TerrenoPlugin} from "../terrenoPlugin";
import {
  createMemoryIdempotencyStore,
  type WebhookClaimArgs,
  type WebhookClaimResult,
  type WebhookIdempotencyStore,
} from "./idempotency/memoryStore";
import {createMongoIdempotencyStore} from "./idempotency/mongoStore";

export interface WebhookHandlerContext {
  body: unknown;
  eventId: string;
  headers: IncomingHttpHeaders;
  rawBody: Buffer;
}

export interface WebhookRouteOptions {
  eventId?: (req: Request) => string;
  handler: (context: WebhookHandlerContext) => Promise<void> | void;
  path: string;
  source: string;
  verify: (req: Request) => boolean | Promise<boolean>;
}

export interface WebhooksAppOptions {
  idempotency?: {
    store?: "memory" | "mongo";
    ttlDays?: number;
  };
}

export class WebhooksApp implements TerrenoPlugin {
  private readonly routes: WebhookRouteOptions[] = [];
  private readonly store: WebhookIdempotencyStore;

  constructor(options: WebhooksAppOptions = {}) {
    const storeKind = options.idempotency?.store ?? "memory";
    if (storeKind === "mongo") {
      this.store = createMongoIdempotencyStore({ttlDays: options.idempotency?.ttlDays});
    } else {
      this.store = createMemoryIdempotencyStore();
    }
  }

  route(options: WebhookRouteOptions): this {
    this.routes.push(options);
    return this;
  }

  claim = async (args: WebhookClaimArgs): Promise<WebhookClaimResult> => {
    return this.store.claim(args);
  };

  release = async (args: WebhookClaimArgs): Promise<void> => {
    await this.store.release(args);
  };

  register(app: Application): void {
    for (const route of this.routes) {
      app.post(
        route.path,
        asyncHandler(async (req: Request, res) => {
          await this.dispatch({req, res, route});
        })
      );
    }
  }

  private dispatch = async ({
    req,
    res,
    route,
  }: {
    req: Request;
    res: Response;
    route: WebhookRouteOptions;
  }): Promise<void> => {
    if (!req.rawBody) {
      throw new APIError({
        code: "webhook-body-missing",
        disableExternalErrorTracking: true,
        status: 400,
        title: "Missing webhook body",
      });
    }

    const isValid = await route.verify(req);
    if (!isValid) {
      throw new APIError({
        code: "webhook-signature-invalid",
        disableExternalErrorTracking: true,
        status: 401,
        title: "Invalid webhook signature",
      });
    }

    const eventId = route.eventId ? route.eventId(req) : "";
    const log = createScopedLogger({
      labels: {eventId: eventId || "none", source: route.source},
      prefix: "[Webhook]",
    });

    if (!eventId) {
      log.warn("Empty eventId; skipping idempotency claim");
    } else {
      const claimResult = await this.claim({eventId, source: route.source});
      if (claimResult === "duplicate") {
        log.info("Duplicate webhook event");
        res.status(200).json({duplicate: true, received: true});
        return;
      }
    }

    try {
      await route.handler({
        body: req.body,
        eventId,
        headers: req.headers,
        rawBody: req.rawBody,
      });
    } catch (error) {
      if (eventId) {
        await this.release({eventId, source: route.source});
      }
      if (isAPIError(error)) {
        throw error;
      }
      throw new APIError({
        cause: error,
        status: 500,
        title: "Webhook handler failed",
      });
    }

    res.status(200).json({received: true});
  };
}
