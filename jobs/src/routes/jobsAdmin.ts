import {
  ADMIN_PAGE_ACTION,
  type AnyTerrenoAccess,
  APIError,
  asyncHandler,
  authenticateMiddleware,
  createOpenApiBuilder,
  ForbiddenError,
  NotFoundError,
  type OpenApiMiddleware,
  UnauthorizedError,
} from "@terreno/api";
import type {Application, Request, Response} from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";

import type {JobsService} from "../jobsService";
import {Job} from "../models/job";
import {JobSchedule} from "../models/jobSchedule";
import type {JobDocument, JobScheduleDocument, JobStatus} from "../modelTypes";
import type {JobsAdminRedactPayload} from "../types";

export interface RegisterJobsAdminRouteOptions {
  accessControl?: AnyTerrenoAccess;
  basePath: string;
  jobsService: JobsService;
  openApi?: unknown;
  redactPayload?: JobsAdminRedactPayload;
}

interface JobsListFilters {
  end?: Date;
  name?: string;
  q?: string;
  scheduleId?: string;
  start?: Date;
  status?: JobStatus;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_Q_LENGTH = 200;

const VALID_JOB_STATUSES = new Set<JobStatus>([
  "cancelled",
  "completed",
  "dead",
  "failed",
  "pending",
  "running",
  "scheduled",
]);

const JOB_ADMIN_ITEM_SCHEMA = {
  _id: {type: "string"},
  attemptCount: {type: "number"},
  id: {type: "string"},
  name: {type: "string"},
  status: {type: "string"},
} as const;

const SCHEDULE_ADMIN_ITEM_SCHEMA = {
  cron: {type: "string"},
  enabled: {type: "boolean"},
  handlerName: {type: "string"},
  id: {type: "string"},
  name: {type: "string"},
  nextRunAt: {format: "date-time", type: "string"},
  timezone: {type: "string"},
} as const;

const pathParam = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readPositiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
};

const escapeRegexLiteral = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseIsoDate = (value: unknown, label: string): Date | undefined => {
  const raw = readString(value);
  if (!raw) {
    return undefined;
  }

  const parsed = DateTime.fromISO(raw, {zone: "utc"});
  if (!parsed.isValid) {
    throw new APIError({status: 400, title: `Invalid ${label}`});
  }

  return parsed.toJSDate();
};

const parseSearchQuery = (value: unknown): string | undefined => {
  const raw = readString(value);
  if (!raw) {
    return undefined;
  }

  if (raw.length > MAX_Q_LENGTH) {
    throw new APIError({status: 400, title: "Search query too long"});
  }

  return escapeRegexLiteral(raw);
};

const parseStatusFilter = (value: unknown): JobStatus | undefined => {
  const status = readString(value);
  if (!status) {
    return undefined;
  }

  if (!VALID_JOB_STATUSES.has(status as JobStatus)) {
    throw new APIError({status: 400, title: "Invalid status"});
  }

  return status as JobStatus;
};

const parseListFilters = (query: Record<string, unknown>): JobsListFilters => ({
  end: parseIsoDate(query.end, "end date"),
  name: readString(query.name),
  q: parseSearchQuery(query.q),
  scheduleId: readString(query.scheduleId),
  start: parseIsoDate(query.start, "start date"),
  status: parseStatusFilter(query.status),
});

const buildListMatch = (filters: JobsListFilters): Record<string, unknown> => {
  const match: Record<string, unknown> = {};

  if (filters.name) {
    match.name = filters.name;
  }

  if (filters.status) {
    match.status = filters.status;
  }

  if (filters.scheduleId) {
    if (!mongoose.isValidObjectId(filters.scheduleId)) {
      throw new APIError({status: 400, title: "Invalid scheduleId"});
    }
    match.scheduleId = new mongoose.Types.ObjectId(filters.scheduleId);
  }

  if (filters.start || filters.end) {
    const created: Record<string, Date> = {};
    if (filters.start) {
      created.$gte = filters.start;
    }
    if (filters.end) {
      created.$lte = filters.end;
    }
    match.created = created;
  }

  if (filters.q) {
    match.$or = [
      {lastError: {$options: "i", $regex: filters.q}},
      {name: {$options: "i", $regex: filters.q}},
    ];
  }

  return match;
};

const projectAdminPayload = (
  job: JobDocument,
  redactPayload?: JobsAdminRedactPayload
): unknown | undefined => {
  if (job.payloadRedacted) {
    return undefined;
  }

  if (!redactPayload) {
    return undefined;
  }

  return redactPayload({
    name: job.name,
    payload: job.payload,
    payloadRedacted: job.payloadRedacted,
  });
};

const serializeJob = (
  job: JobDocument,
  redactPayload?: JobsAdminRedactPayload
): Record<string, unknown> => {
  const json = job.toJSON() as Record<string, unknown>;
  const {payload: _storedPayload, ...rest} = json;
  const projectedPayload = projectAdminPayload(job, redactPayload);

  if (projectedPayload === undefined) {
    return {
      ...rest,
      id: job._id.toString(),
    };
  }

  return {
    ...rest,
    id: job._id.toString(),
    payload: projectedPayload,
  };
};

const serializeSchedule = (schedule: JobScheduleDocument): Record<string, unknown> => {
  const json = schedule.toJSON() as Record<string, unknown>;
  return {
    ...json,
    id: schedule._id.toString(),
  };
};

const createRequireJobsAdmin =
  (accessControl?: AnyTerrenoAccess) =>
  async (req: Request): Promise<void> => {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (accessControl) {
      const result = await accessControl.can({
        permissions: {admin: [ADMIN_PAGE_ACTION, "jobs"]},
        user: user as Parameters<AnyTerrenoAccess["can"]>[0]["user"],
      });

      if (!result.allowed) {
        throw new ForbiddenError({
          detail: result.reason,
          title: "Jobs admin access required",
        });
      }

      return;
    }

    if (!(user as {admin?: boolean}).admin) {
      throw new ForbiddenError("Admin access required");
    }
  };

const listQueryParameters = (
  builder: ReturnType<typeof createOpenApiBuilder>
): ReturnType<typeof createOpenApiBuilder> =>
  builder
    .withQueryParameter("page", {type: "number"}, {required: false})
    .withQueryParameter("limit", {type: "number"}, {required: false})
    .withQueryParameter("name", {type: "string"}, {required: false})
    .withQueryParameter("status", {type: "string"}, {required: false})
    .withQueryParameter("scheduleId", {type: "string"}, {required: false})
    .withQueryParameter("start", {type: "string"}, {required: false})
    .withQueryParameter("end", {type: "string"}, {required: false})
    .withQueryParameter("q", {type: "string"}, {required: false});

export const registerJobsAdminRoutes = ({
  app,
  options,
}: {
  app: Application;
  options: RegisterJobsAdminRouteOptions;
}): void => {
  const routeOpenApi = options.openApi ? {openApi: options.openApi as OpenApiMiddleware} : {};
  const requireJobsAdmin = createRequireJobsAdmin(options.accessControl);
  const basePath = options.basePath;
  const {jobsService, redactPayload} = options;

  app.get(
    `${basePath}/schedules`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "jobs"])
        .withSummary("List configured job schedules")
        .withResponse(200, {
          data: {
            items: {
              properties: SCHEDULE_ADMIN_ITEM_SCHEMA,
              type: "object",
            },
            type: "array",
          },
        })
        .build(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      await requireJobsAdmin(req);
      const schedules = await JobSchedule.find({}).sort("name");
      return res.json({data: schedules.map((schedule) => serializeSchedule(schedule))});
    })
  );

  app.post(
    `${basePath}/schedules/:name/pause`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "jobs"])
        .withSummary("Pause a job schedule")
        .withPathParameter("name", {type: "string"})
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      await requireJobsAdmin(req);
      const name = pathParam(req.params.name);
      if (!name) {
        throw new NotFoundError("Schedule not found");
      }

      const schedule = await jobsService.pauseSchedule(name);
      return res.json({data: serializeSchedule(schedule)});
    })
  );

  app.post(
    `${basePath}/schedules/:name/resume`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "jobs"])
        .withSummary("Resume a job schedule")
        .withPathParameter("name", {type: "string"})
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      await requireJobsAdmin(req);
      const name = pathParam(req.params.name);
      if (!name) {
        throw new NotFoundError("Schedule not found");
      }

      const schedule = await jobsService.resumeSchedule(name);
      return res.json({data: serializeSchedule(schedule)});
    })
  );

  app.get(
    basePath,
    [
      authenticateMiddleware(),
      listQueryParameters(
        createOpenApiBuilder(routeOpenApi)
          .withTags(["admin", "jobs"])
          .withSummary("List background jobs")
      )
        .withResponse(200, {
          data: {
            items: {
              properties: JOB_ADMIN_ITEM_SCHEMA,
              type: "object",
            },
            type: "array",
          },
          limit: {type: "number"},
          more: {type: "boolean"},
          page: {type: "number"},
          total: {type: "number"},
        })
        .build(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      await requireJobsAdmin(req);
      const filters = parseListFilters(req.query as Record<string, unknown>);
      const page = readPositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
      const limit = readPositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
      const skip = (page - 1) * limit;
      const match = buildListMatch(filters);
      const [jobs, total] = await Promise.all([
        Job.find(match).sort("-created").skip(skip).limit(limit),
        Job.countDocuments(match),
      ]);

      return res.json({
        data: jobs.map((job) => serializeJob(job, redactPayload)),
        limit,
        more: skip + limit < total,
        page,
        total,
      });
    })
  );

  app.get(
    `${basePath}/:id`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "jobs"])
        .withSummary("Read one background job")
        .withPathParameter("id", {type: "string"})
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      await requireJobsAdmin(req);
      const id = pathParam(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        throw new NotFoundError("Job not found");
      }

      const job = await Job.findOneOrNone({_id: id});
      if (!job) {
        throw new NotFoundError("Job not found");
      }

      return res.json({data: serializeJob(job, redactPayload)});
    })
  );

  app.post(
    `${basePath}/:id/retry`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "jobs"])
        .withSummary("Retry a background job by creating a linked row")
        .withPathParameter("id", {type: "string"})
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      await requireJobsAdmin(req);
      const id = pathParam(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        throw new NotFoundError("Job not found");
      }

      const {retry} = await jobsService.adminRetryJob(id);
      return res.json({data: serializeJob(retry, redactPayload)});
    })
  );

  app.post(
    `${basePath}/:id/requeue`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "jobs"])
        .withSummary("Requeue a dead, failed, or cancelled job")
        .withPathParameter("id", {type: "string"})
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      await requireJobsAdmin(req);
      const id = pathParam(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        throw new NotFoundError("Job not found");
      }

      const job = await jobsService.adminRequeueJob(id);
      return res.json({data: serializeJob(job, redactPayload)});
    })
  );

  app.post(
    `${basePath}/:id/cancel`,
    [
      authenticateMiddleware(),
      createOpenApiBuilder(routeOpenApi)
        .withTags(["admin", "jobs"])
        .withSummary("Cancel a pending, scheduled, or running job")
        .withPathParameter("id", {type: "string"})
        .withResponse(200, {data: {type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      await requireJobsAdmin(req);
      const id = pathParam(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) {
        throw new NotFoundError("Job not found");
      }

      const job = await jobsService.adminCancelJob(id);
      return res.json({data: serializeJob(job, redactPayload)});
    })
  );
};
