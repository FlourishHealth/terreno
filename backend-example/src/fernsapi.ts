import {Logging} from "@google-cloud/logging";
import * as Sentry from "@sentry/node";
import type {NextFunction, Request, Response} from "express";
import cloneDeep from "lodash/cloneDeep";
import mongoose from "mongoose";
import type {UserDocument} from "./types";
import {logger} from "./utils/logger";

// Cloud logging client
const cloudLogging = new Logging();

// LogEntry type from Google Cloud Logging
type LogEntry = {
	httpRequest?: {
		latency?: {
			nanos: number;
		};
		requestMethod: string;
		requestUrl: string;
		responseSize?: string;
		status: number;
		userAgent?: string;
	};
	labels?: Record<string, string>;
	severity?: string;
};

// Functions that need to be open sourced to ferns-api.

// Ensure that all models are set to strict mode.
export function checkModelsStrict(ignoredModels: string[] = []): void {
	const models = mongoose.modelNames();
	for (const model of models) {
		const schema = mongoose.model(model).schema;

		if (schema.get("toObject")?.virtuals !== true) {
			throw new Error(`Model ${model} toObject.virtuals not set to true`);
		}
		if (schema.get("toJSON")?.virtuals !== true) {
			throw new Error(`Model ${model} toJSON.virtuals not set to true`);
		}

		if (ignoredModels.includes(model)) {
			continue;
		}
		if (schema.get("strict") !== "throw") {
			throw new Error(`Model ${model} is not set to strict mode.`);
		}
	}
}

export function logRequestsFinished(
	req: Request & {body?: Record<string, unknown>},
	res: Response,
	startTime: [number, number]
): void {
	const diff = process.hrtime(startTime);
	const diffInMs = Math.round(diff[0] * 1000 + diff[1] * 0.000001);
	// Extended user type with optional properties not in base UserDocument
	type ExtendedUser = UserDocument & {testUser?: boolean; type?: string};
	const reqUser = req.user as ExtendedUser | undefined;

	// Use async logging for better performance in request handling
	const log = cloudLogging.log("totum-api-request");

	let userString = "";
	if (req.user) {
		let type = "User";
		if (reqUser?.testUser) {
			type = "Test User";
		} else if (reqUser?.type) {
			type = reqUser?.type;
		}
		userString = ` <${type}:${reqUser?.id}>`;
	}

	let body = "";
	if (req.body && Object.keys(req.body).length > 0) {
		const bodyCopy = cloneDeep(req.body);
		if (bodyCopy.password) {
			bodyCopy.password = "<PASSWORD>";
		}
		body = ` Body: ${JSON.stringify(bodyCopy)}`;
	}

	const metadata: LogEntry = {
		httpRequest: {
			latency: {
				nanos: diffInMs * 1000,
			},
			requestMethod: req.method,
			requestUrl: req.url,
			responseSize: res.get("content-length"),
			status: req.statusCode ?? res.statusCode,
			userAgent: req.get("user-agent"),
		},
		labels: {
			requestTime: String(diffInMs),
			testUser: String(reqUser?.testUser),
			userId: reqUser?.id ?? "anonymous",
			userType: reqUser?.type ?? "anonymous",
		},
		severity: res.statusCode < 400 ? "DEFAULT" : "ERROR",
	};

	// Use async logging without awaiting to avoid blocking the response
	const logString = `${req.method} <- ${req.url}${userString}${body}`;
	log.write(log.entry(metadata, logString)).catch((error: Error) => {
		logger.error(
			`Error writing request log: ${error.message}. Original log: ${JSON.stringify(metadata)} ${logString}`
		);
	});
}

export function sentryAppVersionMiddleware(req: Request, _res: Response, next: NextFunction): void {
	// Capture the version from the app and add to Sentry
	const appVersion = req.get("App-Version");
	if (appVersion) {
		Sentry.getCurrentScope().setTag("app_version", appVersion);
	}
	next();
}
