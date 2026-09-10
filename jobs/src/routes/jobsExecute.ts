import {
  APIError,
  asyncHandler,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "@terreno/api";
import type {Application, Request} from "express";

import {executeJobById, type JobExecutionHost} from "../jobExecutor";

export type ExecuteAuthVerifier = (req: Request) => boolean | Promise<boolean>;

export interface RegisterJobsExecuteRouteOptions {
  basePath: string;
  executeAuth: ExecuteAuthVerifier;
  host: JobExecutionHost;
}

const JOB_NOT_FOUND_TITLE = "Job not found";

const readJobId = (body: unknown): string | undefined => {
  if (!body || typeof body !== "object" || !("jobId" in body)) {
    return undefined;
  }

  const {jobId} = body as {jobId?: unknown};
  if (typeof jobId !== "string") {
    return undefined;
  }

  const trimmed = jobId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const serializeJob = (job: {toJSON: () => Record<string, unknown>}): Record<string, unknown> => {
  const json = job.toJSON();
  if (json._id && typeof json._id === "object" && "toString" in json._id) {
    return {
      ...json,
      id: (json._id as {toString: () => string}).toString(),
    };
  }

  return json;
};

export const registerJobsExecuteRoute = ({
  app,
  options,
}: {
  app: Application;
  options: RegisterJobsExecuteRouteOptions;
}): void => {
  const path = `${options.basePath}/execute`;

  app.post(
    path,
    asyncHandler(async (req, res) => {
      let authorized = false;
      try {
        authorized = Boolean(await options.executeAuth(req));
      } catch {
        authorized = false;
      }

      if (!authorized) {
        throw new UnauthorizedError("Unauthorized");
      }

      const jobId = readJobId(req.body);
      if (!jobId) {
        throw new APIError({status: 400, title: "jobId is required"});
      }

      const outcome = await executeJobById({
        host: options.host,
        jobId,
        signal: AbortSignal.timeout(30 * 60 * 1_000),
      });

      if (outcome.kind === "not_found") {
        throw new NotFoundError(JOB_NOT_FOUND_TITLE);
      }

      if (outcome.kind === "conflict") {
        throw new ConflictError(
          outcome.reason === "not_due" ? "Job is not due yet" : "Job is already running"
        );
      }

      return res.status(200).json({data: serializeJob(outcome.job)});
    })
  );
};
