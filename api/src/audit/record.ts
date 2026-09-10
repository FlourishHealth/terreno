import type {Request} from "express";
import mongoose from "mongoose";

import {logger} from "../logger";
import type {AuditEventModel, AuditEventOperation, AuditEventVerb} from "./auditEventModel";
import {changedFieldDiff, recordLabelFromDoc, toAuditPlain} from "./diff";

export interface ModelRouterAuditOptions {
  redact?: string[];
}

export type ModelRouterAuditConfig = boolean | ModelRouterAuditOptions;

export interface AuditEventWrite {
  actorId?: string;
  after?: Record<string, unknown>;
  before?: Record<string, unknown>;
  modelName: string;
  operation: AuditEventOperation;
  organizationId?: string;
  recordId?: string;
  recordLabel?: string;
  source: "admin" | "modelRouter" | "rbac";
  verb: AuditEventVerb;
}

const MISSING_PLUGIN_MESSAGE =
  "modelRouter audit: true requires AuditApp to be registered; skipping AuditEvent write";

let auditEventModel: AuditEventModel | undefined;
let missingPluginLogged = false;

export const installAuditRecorder = (model: AuditEventModel): void => {
  auditEventModel = model;
};

export const resetAuditRecorderForTests = (): void => {
  auditEventModel = undefined;
  missingPluginLogged = false;
};

export const resolveAuditRedact = (audit?: ModelRouterAuditConfig): string[] | undefined => {
  if (!audit) {
    return undefined;
  }
  if (audit === true) {
    return [];
  }
  return audit.redact ?? [];
};

export const actorIdFromRequest = (req: Request): string | undefined => {
  const user = req.user;
  if (!user) {
    return undefined;
  }
  if (user.id) {
    return String(user.id);
  }
  if (user._id) {
    return String(user._id);
  }
  return undefined;
};

const persistAuditEvent = async (write: AuditEventWrite): Promise<void> => {
  if (write.modelName === "AuditEvent") {
    return;
  }
  if (!auditEventModel) {
    if (!missingPluginLogged) {
      missingPluginLogged = true;
      logger.error(MISSING_PLUGIN_MESSAGE);
    }
    return;
  }
  await auditEventModel.create({
    ...(write.actorId ? {actorId: new mongoose.Types.ObjectId(write.actorId)} : {}),
    ...(write.after ? {after: write.after} : {}),
    ...(write.before ? {before: write.before} : {}),
    modelName: write.modelName,
    operation: write.operation,
    ...(write.organizationId ? {organizationId: write.organizationId} : {}),
    ...(write.recordId ? {recordId: write.recordId} : {}),
    ...(write.recordLabel ? {recordLabel: write.recordLabel} : {}),
    source: write.source,
    verb: write.verb,
  });
};

export const recordAuditEvent = async (write: AuditEventWrite): Promise<void> => {
  try {
    await persistAuditEvent(write);
  } catch (error: unknown) {
    logger.error("Failed to persist AuditEvent", error);
  }
};

export const maybeRecordModelRouterAudit = async ({
  after,
  audit,
  before,
  modelName,
  operation,
  recordId,
  req,
  verb,
}: {
  after?: unknown;
  audit?: ModelRouterAuditConfig;
  before?: unknown;
  modelName: string;
  operation: AuditEventOperation;
  recordId?: string;
  req: Request;
  verb: AuditEventVerb;
}): Promise<void> => {
  const extraRedact = resolveAuditRedact(audit);
  if (extraRedact === undefined) {
    return;
  }
  const beforePlain = toAuditPlain(before);
  const afterPlain = toAuditPlain(after);
  const diff = changedFieldDiff({after: afterPlain, before: beforePlain, extraRedact});
  await recordAuditEvent({
    actorId: actorIdFromRequest(req),
    after: diff.after,
    before: diff.before,
    modelName,
    operation,
    recordId,
    recordLabel: recordLabelFromDoc(afterPlain) ?? recordLabelFromDoc(beforePlain),
    source: "modelRouter",
    verb,
  });
};
