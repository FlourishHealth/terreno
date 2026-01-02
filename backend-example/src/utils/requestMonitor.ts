import {AsyncLocalStorage} from "async_hooks";
import type {NextFunction, Request, Response} from "express";
import {logger} from "@terreno/api";

interface RequestTiming {
	startTime: [number, number];
	middlewareTimes: {[key: string]: number};
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

// Store timing data per request
const requestTimings = new WeakMap<Request, RequestTiming>();

// AsyncLocalStorage for request-scoped context (prevents race conditions)
const requestContext = new AsyncLocalStorage<Request>();

// Only log slow requests to avoid noise
const SLOW_REQUEST_THRESHOLD_MS = process.env.SLOW_REQUEST_THRESHOLD_MS
	? Number.parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10)
	: 1000;
const MEMORY_SAMPLE_INTERVAL_MS = process.env.MEMORY_SAMPLE_INTERVAL_MS
	? Number.parseInt(process.env.MEMORY_SAMPLE_INTERVAL_MS, 10)
	: 500;
const SLOW_DB_QUERY_THRESHOLD_MS = process.env.SLOW_DB_QUERY_THRESHOLD_MS
	? Number.parseInt(process.env.SLOW_DB_QUERY_THRESHOLD_MS, 10)
	: 250;

export const requestMonitorMiddleware = (req: Request, res: Response, next: NextFunction): void => {
	// Skip health check requests
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

	// Run the rest of the request in the AsyncLocalStorage context
	requestContext.run(req, () => {
		// Sample memory usage periodically during request
		const memoryInterval = setInterval(() => {
			const memUsage = process.memoryUsage();
			timing.memorySnapshots.push({
				heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
				heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
				timestamp: Date.now(),
			});
		}, MEMORY_SAMPLE_INTERVAL_MS);

		// Override res.end to capture final timing
		const originalEnd = res.end;
		// biome-ignore lint/suspicious/noExplicitAny: Express Response.end has multiple overload signatures with varying types
		res.end = function (chunk?: any, encoding?: any): Response {
			clearInterval(memoryInterval);

			const diff = process.hrtime(startTime);
			const totalMs = Math.round(diff[0] * 1000 + diff[1] * 0.000001);

			// Only log if request was slow
			if (totalMs > SLOW_REQUEST_THRESHOLD_MS) {
				logSlowRequest(req, res, timing, totalMs);
			}

			return originalEnd.call(this, chunk, encoding) as Response;
		};

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
		// biome-ignore lint/suspicious/noExplicitAny: NextFunction can accept error parameter or no parameters, making typing complex
		next = function (this: unknown, ...args: any[]): void {
			const diff = process.hrtime(startTime);
			const duration = Math.round(diff[0] * 1000 + diff[1] * 0.000001);
			timing.middlewareTimes[name] = duration;
			originalNext(...args);
		};

		next();
	};
};

export const trackDbQuery = (req: Request, query: string, startTime: [number, number]): void => {
	const timing = requestTimings.get(req);
	if (!timing) return;

	const diff = process.hrtime(startTime);
	const duration = Math.round(diff[0] * 1000 + diff[1] * 0.000001);

	timing.dbQueries.push({
		duration,
		query: query.substring(0, 100) + (query.length > 100 ? "..." : ""), // Truncate long queries
		timestamp: Date.now(),
	});
};

// Helper function to get current request from AsyncLocalStorage
const getCurrentRequest = (): Request | null => {
	return requestContext.getStore() || null;
};

function logSlowRequest(req: Request, res: Response, timing: RequestTiming, totalMs: number): void {
	// User type from Express.Request.user - may have id property
	const reqUser = req.user as {id?: string} | undefined;
	const userId = reqUser?.id || "anonymous";

	// Calculate memory delta
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
}

// Mongoose query monitoring using a simpler approach
export const setupMongooseMonitoring = (): void => {
	const mongoose = require("mongoose");

	// Store original methods
	const originalExec = mongoose.Query.prototype.exec;
	const originalAggregate = mongoose.Model.aggregate;

	// Override exec method to catch all query executions
	// biome-ignore lint/suspicious/noExplicitAny: Mongoose callback can be undefined or have various signatures
	mongoose.Query.prototype.exec = function (callback: any): any {
		const startTime = process.hrtime();
		const queryString = JSON.stringify(this.getQuery()).substring(0, 200);
		const operation = this.op || "unknown";

		const result = originalExec.call(this, callback);

		if (result && typeof result.then === "function") {
			return (
				result
					// biome-ignore lint/suspicious/noExplicitAny: Query result type varies by operation and can't be strictly typed here
					.then((res: any) => {
						const diff = process.hrtime(startTime);
						const duration = Math.round(diff[0] * 1000 + diff[1] * 0.000001);

						// Track query in current request if available
						const currentRequest = getCurrentRequest();
						if (currentRequest) {
							trackDbQuery(currentRequest, `${operation}: ${queryString}`, startTime);
						}

						if (duration > SLOW_DB_QUERY_THRESHOLD_MS) {
							logger.warn(`[lag] SLOW_QUERY: ${duration}ms - ${operation}: ${queryString}`);
						}

						return res;
					})
					.catch((error: unknown) => {
						const diff = process.hrtime(startTime);
						const duration = Math.round(diff[0] * 1000 + diff[1] * 0.000001);

						// Track query in current request if available
						const currentRequest = getCurrentRequest();
						if (currentRequest) {
							trackDbQuery(currentRequest, `${operation}: ${queryString}`, startTime);
						}

						if (duration > SLOW_DB_QUERY_THRESHOLD_MS) {
							logger.warn(`[lag] SLOW_QUERY: ${duration}ms - ${operation}: ${queryString} (ERROR)`);
						}

						throw error;
					})
			);
		}

		return result;
	};

	// Override aggregate method
	// biome-ignore lint/suspicious/noExplicitAny: Aggregate pipeline and options have complex dynamic structure
	mongoose.Model.aggregate = function (pipeline: any, options: any): any {
		const startTime = process.hrtime();
		const queryString = JSON.stringify(pipeline).substring(0, 200);

		return (
			originalAggregate
				.call(this, pipeline, options)
				// biome-ignore lint/suspicious/noExplicitAny: Aggregate result type varies by pipeline and can't be strictly typed
				.then((result: any) => {
					const diff = process.hrtime(startTime);
					const duration = Math.round(diff[0] * 1000 + diff[1] * 0.000001);

					// Track query in current request if available
					const currentRequest = getCurrentRequest();
					if (currentRequest) {
						trackDbQuery(currentRequest, `aggregate: ${queryString}`, startTime);
					}

					if (duration > SLOW_DB_QUERY_THRESHOLD_MS) {
						logger.warn(`[lag] SLOW_QUERY: ${duration}ms - aggregate: ${queryString}`);
					}

					return result;
				})
				.catch((error: unknown) => {
					const diff = process.hrtime(startTime);
					const duration = Math.round(diff[0] * 1000 + diff[1] * 0.000001);

					// Track query in current request if available
					const currentRequest = getCurrentRequest();
					if (currentRequest) {
						trackDbQuery(currentRequest, `aggregate: ${queryString}`, startTime);
					}

					if (duration > SLOW_DB_QUERY_THRESHOLD_MS) {
						logger.warn(`[lag] SLOW_QUERY: ${duration}ms - aggregate: ${queryString} (ERROR)`);
					}

					throw error;
				})
		);
	};
};
