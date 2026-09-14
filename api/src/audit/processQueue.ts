import {timingSafeEqual} from "node:crypto";

import type {Request, Response} from "express";

import {APIError} from "../errors";
import {AUDIT_SECRET_HEADER} from "./cloudTasksEnqueue";
import type {AuditEventWrite} from "./record";
import {persistEnqueuedAuditEvent} from "./record";

export const secretsMatch = (provided: string | undefined, expected: string): boolean => {
  if (!provided) {
    return false;
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
};

const isAuditEventWrite = (value: unknown): value is AuditEventWrite => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.modelName === "string" && typeof record.operation === "string";
};

export const handleEnqueuedAuditWrite = async ({
  req,
  res,
  secret,
}: {
  req: Request;
  res: Response;
  secret: string;
}): Promise<Response> => {
  const provided = req.header(AUDIT_SECRET_HEADER);
  if (!secretsMatch(provided, secret)) {
    throw new APIError({status: 401, title: "Unauthorized"});
  }
  if (!isAuditEventWrite(req.body)) {
    throw new APIError({status: 400, title: "Invalid AuditEvent payload"});
  }
  await persistEnqueuedAuditEvent(req.body);
  return res.status(204).end();
};
