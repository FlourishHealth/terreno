import {AsyncLocalStorage} from "node:async_hooks";
import {logger} from "@terreno/api";
import type {NextFunction, Request, Response} from "express";
import {DateTime} from "luxon";
import type {AggregateOptions, Callback, PipelineStage, Query} from "mongoose";

interface RequestTiming {
  startTime: [number, number];
  middlewareTimes: Record<string, number>;
  dbQueries: Array<{
    query: string;
    duration: number;
    timestamp: number;
  }>;
  memorySnapshots: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
  }>;
}

const requestTimings = new WeakMap<Request, RequestTiming>();

const requestContext = new AsyncLocalStorage<Request>();

const SLOW_REQUEST_THRESHOLD_MS = process.env.SLOW_REQUEST_THRESHOLD_MS
  ? Number.parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10)
  : 1000;
const MEMORY_SAMPLE_INTERVAL_MS = process.env.MEMORY_SAMPLE_INTERVAL_MS
  ? Number.parseInt(process.env.MEMORY_SAMPLE_INTERVAL_MS, 10)
  : 500;
const SLOW_DB_QUERY_THRESHOLD_MS = process.env.SLOW_DB_QUERY_THRESHOLD_MS
  ? Number.parseInt(process.env.SLOW_DB_QUERY_THRESHOLD_MS, 10)
  : 250;

const getCurrentRequest = (): Request | null => {
  return requestContext.getStore() || null;
};

const logSlowRequest = (
  req: Request,
  res: Response,
  timing: RequestTiming,
  totalMs: number
): void => {
  const reqUser = req.user as {id?: string} | undefined;
  const userId = reqUser?.id || "anonymous";

  const memoryDelta =
    timing.memorySnapshots.length > 1
      ? timing.memorySnapshots[timing.memorySnapshots.length - 1].heapUsed -
        timing.memorySnapshots[0].heapUsed
      : 0;

  const logData = {
    dbQueries: timing.dbQueries,
    dbQueryCount: timing.dbQueries.length,
    memoryDeltaMB: memoryDelta,
    method: req.method,
    middlewareTimes: timing.middlewareTimes,
    statusCode: res.statusCode,
    totalDbTime: timing.dbQueries.reduce((sum, q) => sum + q.duration, 0),
    totalMs,
    url: req.url,
    userAgent: req.get("user-agent")?.substring(0, 100),
    userId,
  };

  logger.warn(`[lag] SLOW_REQUEST: ${JSON.stringify(logData)}`);
};

export const requestMonitorMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === "/health") {
    next();
    return;
  }

  const startTime = process.hrtime();
  const timing: RequestTiming = {
    dbQueries: [],
    memorySnapshots: [],
    middlewareTimes: {},
    startTime,
  };

  requestTimings.set(req, timing);

  requestContext.run(req, () => {
    const memoryInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      timing.memorySnapshots.push({
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        timestamp: DateTime.now().toMillis(),
      });
    }, MEMORY_SAMPLE_INTERVAL_MS);

    const originalEnd = res.end.bind(res);
    res.end = ((...args: unknown[]): Response => {
      clearInterval(memoryInterval);

      const diff = process.hrtime(startTime);
      const totalMs = Math.round(diff[0] * 1000 + diff[1] * 0.000001);

      if (totalMs > SLOW_REQUEST_THRESHOLD_MS) {
        logSlowRequest(req, res, timing, totalMs);
      }

      return (originalEnd as (...innerArgs: unknown[]) => Response).apply(res, args);
    }) as typeof res.end;

    next();
  });
};

export const trackMiddleware = (name: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const timing = requestTimings.get(req);
    if (!timing) {
      next();
      return;
    }

    const startTime = process.hrtime();

    const originalNext = next;
    const wrappedNext: NextFunction = (...args) => {
      const diff = process.hrtime(startTime);
      const duration = Math.round(diff[0] * 1000 + diff[1] * 0.000001);
      timing.middlewareTimes[name] = duration;
      originalNext(...args);
    };
    next = wrappedNext;

    next();
  };
};

export const trackDbQuery = (req: Request, query: string, startTime: [number, number]): void => {
  const timing = requestTimings.get(req);
  if (!timing) {
    return;
  }

  const diff = process.hrtime(startTime);
  const duration = Math.round(diff[0] * 1000 + diff[1] * 0.000001);

  timing.dbQueries.push({
    duration,
    query: query.substring(0, 100) + (query.length > 100 ? "..." : ""),
    timestamp: DateTime.now().toMillis(),
  });
};

/** Minimal shape of the Mongoose query internals the exec wrapper reads. */
interface MonitoredQuery {
  getQuery: () => unknown;
  op?: string;
}

type QueryExecFn = (this: MonitoredQuery, callback?: Callback<unknown>) => unknown;

type ModelAggregateFn = (
  this: unknown,
  pipeline?: PipelineStage[],
  options?: AggregateOptions
) => Promise<unknown[]>;

const isPromiseLike = (value: unknown): value is Promise<unknown> => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as {then?: unknown}).then === "function"
  );
};

const elapsedMs = (startTime: [number, number]): number => {
  const diff = process.hrtime(startTime);
  return Math.round(diff[0] * 1000 + diff[1] * 0.000001);
};

const recordDbQuery = ({
  label,
  startTime,
  suffix,
}: {
  label: string;
  startTime: [number, number];
  suffix?: string;
}): void => {
  const duration = elapsedMs(startTime);

  const currentRequest = getCurrentRequest();
  if (currentRequest) {
    trackDbQuery(currentRequest, label, startTime);
  }

  if (duration > SLOW_DB_QUERY_THRESHOLD_MS) {
    logger.warn(`[lag] SLOW_QUERY: ${duration}ms - ${label}${suffix ?? ""}`);
  }
};

/**
 * Wraps `Query.prototype.exec` so queries run inside a monitored request are
 * timed. Taking the original as an argument keeps the timing logic testable
 * without patching Mongoose globals.
 */
export const createMonitoredQueryExec = (originalExec: QueryExecFn): QueryExecFn => {
  return function monitoredExec(
    this: MonitoredQuery,
    callback?: Callback<unknown>
  ): Promise<unknown> | Query<unknown, unknown> {
    const startTime = process.hrtime();
    const queryString = JSON.stringify(this.getQuery()).substring(0, 200);
    const label = `${this.op || "unknown"}: ${queryString}`;

    const result = originalExec.call(this, callback);

    if (isPromiseLike(result)) {
      return result
        .then((res: unknown) => {
          recordDbQuery({label, startTime});
          return res;
        })
        .catch((error: unknown) => {
          recordDbQuery({label, startTime, suffix: " (ERROR)"});
          throw error;
        });
    }

    return result as Query<unknown, unknown>;
  };
};

/** Wraps `Model.aggregate` with the same request-scoped timing as query exec. */
export const createMonitoredAggregate = (originalAggregate: ModelAggregateFn): ModelAggregateFn => {
  return function monitoredAggregate(
    this: unknown,
    pipeline?: PipelineStage[],
    options?: AggregateOptions
  ): Promise<unknown[]> {
    const startTime = process.hrtime();
    const label = `aggregate: ${JSON.stringify(pipeline).substring(0, 200)}`;

    return originalAggregate
      .call(this, pipeline, options)
      .then((result: unknown[]) => {
        recordDbQuery({label, startTime});
        return result;
      })
      .catch((error: unknown) => {
        recordDbQuery({label, startTime, suffix: " (ERROR)"});
        throw error;
      });
  };
};

export const setupMongooseMonitoring = (): void => {
  // Dynamic require for untyped monkey-patching of Mongoose internals
  const mongoose = require("mongoose");

  mongoose.Query.prototype.exec = createMonitoredQueryExec(mongoose.Query.prototype.exec);
  mongoose.Model.aggregate = createMonitoredAggregate(mongoose.Model.aggregate);
};
