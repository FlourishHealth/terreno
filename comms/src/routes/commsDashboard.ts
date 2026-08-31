import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  isAPIError,
  type OpenApiMiddleware,
} from "@terreno/api";
import type express from "express";
import mongoose from "mongoose";
import {
  buildCommsMessageMatch,
  parseCommsListFilters,
  parseCommsListPagination,
  parseRetryManyLimit,
} from "../commsQuery";
import {serializeCommsMessage} from "../commsRetry";
import type {CommsService} from "../commsService";
import {CommsMessage} from "../models/commsMessage";
import type {CommsChannel} from "../types";

interface CommsDashboardRouteOptions {
  basePath?: string;
  openApi?: unknown;
  service: CommsService;
}

const requireAdmin = (req: express.Request): {id?: string} => {
  const user = req.user as
    | {admin?: boolean; id?: string; _id?: {toString: () => string}}
    | undefined;
  if (!user?.admin) {
    throw new APIError({status: 403, title: "Admin access required"});
  }
  return {id: user.id ?? user._id?.toString()};
};

const listQueryParameters = (
  builder: ReturnType<typeof createOpenApiBuilder>
): ReturnType<typeof createOpenApiBuilder> =>
  builder
    .withQueryParameter("page", {type: "number"}, {required: false})
    .withQueryParameter("limit", {type: "number"}, {required: false})
    .withQueryParameter("channel", {type: "string"}, {required: false})
    .withQueryParameter("provider", {type: "string"}, {required: false})
    .withQueryParameter("status", {type: "string"}, {required: false})
    .withQueryParameter("errorClass", {type: "string"}, {required: false})
    .withQueryParameter("errorCode", {type: "string"}, {required: false})
    .withQueryParameter("userId", {type: "string"}, {required: false})
    .withQueryParameter("to", {type: "string"}, {required: false})
    .withQueryParameter("templateId", {type: "string"}, {required: false})
    .withQueryParameter("retriedFromId", {type: "string"}, {required: false})
    .withQueryParameter("startDate", {type: "string"}, {required: false})
    .withQueryParameter("endDate", {type: "string"}, {required: false})
    .withQueryParameter("q", {type: "string"}, {required: false});

const filterBodyFields = {
  channel: {type: "string"},
  endDate: {type: "string"},
  errorClass: {type: "string"},
  errorCode: {type: "string"},
  limit: {type: "number"},
  provider: {type: "string"},
  q: {type: "string"},
  retriedFromId: {type: "string"},
  startDate: {type: "string"},
  status: {type: "string"},
  templateId: {type: "string"},
  to: {type: "string"},
  userId: {type: "string"},
};

const pathId = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const failureRate = (failed: number, total: number): number => {
  if (total === 0) {
    return 0;
  }
  return failed / total;
};

export const addCommsDashboardRoutes = (
  app: express.Application,
  options: CommsDashboardRouteOptions
): void => {
  const basePath = options.basePath ?? "/comms";
  const routeOpenApi = options.openApi ? {openApi: options.openApi as OpenApiMiddleware} : {};
  const {service} = options;
  const isConfigured = (channel: CommsChannel): boolean => service.isChannelConfigured(channel);

  app.get(
    `${basePath}/messages`,
    [
      authenticateMiddleware(),
      listQueryParameters(
        createOpenApiBuilder(routeOpenApi)
          .withTags(["admin", "comms"])
          .withSummary("List communication delivery attempts")
      )
        .withResponse(200, {
          data: {items: {type: "object"}, type: "array"},
          limit: {type: "number"},
          more: {type: "boolean"},
          page: {type: "number"},
          total: {type: "number"},
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      requireAdmin(req);
      const filters = parseCommsListFilters(req.query as Record<string, unknown>);
      const {limit, page, skip} = parseCommsListPagination(req.query as Record<string, unknown>);
      const match = buildCommsMessageMatch(filters);
      const [messages, total] = await Promise.all([
        CommsMessage.find(match).sort("-created").skip(skip).limit(limit),
        CommsMessage.countDocuments(match),
      ]);
      return res.json({
        data: messages.map((message) => serializeCommsMessage(message, isConfigured)),
        limit,
        more: skip + limit < total,
        page,
        total,
      });
    })
  );

  app.post(
    `${basePath}/messages/retryMany`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "comms"])
        .withSummary("Retry matching failed communication messages")
        .withRequestBody(filterBodyFields)
        .withResponse(200, {
          retried: {items: {type: "object"}, type: "array"},
          skipped: {items: {type: "object"}, type: "array"},
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const admin = requireAdmin(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const limit = parseRetryManyLimit(body.limit);
      const match = buildCommsMessageMatch(parseCommsListFilters(body));
      const candidates = await CommsMessage.find(match).sort("-created").limit(limit);
      const retried: Record<string, unknown>[] = [];
      const skipped: {id: string; reason: string}[] = [];
      for (const candidate of candidates) {
        try {
          const created = await service.retryMessage({
            messageId: String(candidate._id),
            retriedByUserId: admin.id,
          });
          retried.push(serializeCommsMessage(created, isConfigured));
        } catch (error: unknown) {
          const title = isAPIError(error) ? error.title : "Message could not be retried";
          skipped.push({id: String(candidate._id), reason: title});
        }
      }
      return res.json({retried, skipped});
    })
  );

  app.get(
    `${basePath}/messages/:id`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "comms"])
        .withSummary("Read one communication delivery attempt")
        .withPathParameter("id", {type: "string"})
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      requireAdmin(req);
      const id = pathId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        throw new APIError({status: 404, title: "Comms message not found"});
      }
      const message = await CommsMessage.findOneOrNone({_id: id});
      if (!message) {
        throw new APIError({status: 404, title: "Comms message not found"});
      }
      const retries = await CommsMessage.find({retriedFromId: message._id}).sort("-created");
      return res.json({
        data: {
          ...serializeCommsMessage(message, isConfigured),
          retries: retries.map((row) => serializeCommsMessage(row, isConfigured)),
        },
      });
    })
  );

  app.post(
    `${basePath}/messages/:id/retry`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "comms"])
        .withSummary("Retry a failed communication message")
        .withPathParameter("id", {type: "string"})
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const admin = requireAdmin(req);
      const id = pathId(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        throw new APIError({status: 404, title: "Comms message not found"});
      }
      const created = await service.retryMessage({
        messageId: id,
        retriedByUserId: admin.id,
      });
      return res.json({
        data: serializeCommsMessage(created, isConfigured),
      });
    })
  );

  app.get(
    `${basePath}/stats`,
    [
      authenticateMiddleware(),
      listQueryParameters(
        createOpenApiBuilder(routeOpenApi)
          .withTags(["admin", "comms"])
          .withSummary("Aggregate communication delivery stats")
      )
        .withResponse(200, {
          buckets: {items: {type: "object"}, type: "array"},
          byProvider: {items: {type: "object"}, type: "array"},
          totals: {type: "object"},
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      requireAdmin(req);
      const filters = parseCommsListFilters(req.query as Record<string, unknown>);
      const match = buildCommsMessageMatch(filters, {applyDefaultStatsRange: true});
      const grouped = await CommsMessage.aggregate([
        {$match: match},
        {
          $group: {
            _id: {
              channel: "$channel",
              day: {$dateToString: {date: "$created", format: "%Y-%m-%d"}},
              provider: "$provider",
              status: "$status",
            },
            count: {$sum: 1},
          },
        },
      ]);

      const totals: Record<string, number> = {
        bounced: 0,
        cancelled: 0,
        delivered: 0,
        failed: 0,
        sent: 0,
        total: 0,
      };
      const providerTotals = new Map<
        string,
        {bounced: number; delivered: number; failed: number; sent: number; total: number}
      >();
      const buckets = grouped.map((row: {_id: Record<string, string>; count: number}) => {
        const status = row._id.status;
        const provider = row._id.provider;
        totals.total += row.count;
        if (status in totals) {
          totals[status] = (totals[status] ?? 0) + row.count;
        }
        const existing = providerTotals.get(provider) ?? {
          bounced: 0,
          delivered: 0,
          failed: 0,
          sent: 0,
          total: 0,
        };
        existing.total += row.count;
        if (
          status === "bounced" ||
          status === "delivered" ||
          status === "failed" ||
          status === "sent"
        ) {
          existing[status] += row.count;
        }
        providerTotals.set(provider, existing);
        return {
          channel: row._id.channel,
          count: row.count,
          day: row._id.day,
          provider,
          status,
        };
      });

      const failedTotal = (totals.failed ?? 0) + (totals.bounced ?? 0);
      return res.json({
        buckets: buckets.sort((left, right) => left.day.localeCompare(right.day)),
        byProvider: [...providerTotals.entries()].map(([provider, counts]) => ({
          ...counts,
          failureRate: failureRate(counts.failed + counts.bounced, counts.total),
          provider,
        })),
        totals: {
          ...totals,
          failureRate: failureRate(failedTotal, totals.total),
        },
      });
    })
  );
};

/** @deprecated Use {@link addCommsDashboardRoutes}. */
export const addCommsExplorerRoute = addCommsDashboardRoutes;
