import type express from "express";
import mongoose from "mongoose";

import type {AdminContribution} from "../adminTypes";
import {asyncHandler, modelRouter} from "../api";
import {logger} from "../logger";
import {Permissions} from "../permissions";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {createAuditEventModel} from "./auditEventModel";
import {auditEnqueueFromEnv} from "./cloudTasksEnqueue";
import {handleEnqueuedAuditWrite} from "./processQueue";
import {type AuditEnqueue, installAuditRecorder} from "./record";

export interface AuditAppOptions {
  /**
   * When set, persist is delegated (Cloud Tasks). Mongo is not written on the
   * request process. Diffs still run inline so before/after is captured now.
   */
  enqueue?: AuditEnqueue;
  /** Shared secret for POST on `processQueuePath`. Required when that path is set. */
  processQueueSecret?: string;
  /**
   * Worker URL path Cloud Tasks should POST to. Defaults to `/internal/audit-events`
   * when enqueue comes from env (`GCP_TASKS_AUDIT_QUEUE` + `AUDIT_TASKS_URL`).
   */
  processQueuePath?: string;
  /** Mongo TTL in days. Omit or 0 = forever (no TTL index). */
  retentionDays?: number;
}

const DEFAULT_PROCESS_QUEUE_PATH = "/internal/audit-events";

export class AuditApp implements TerrenoPlugin {
  private readonly options: AuditAppOptions;
  private readonly enqueue: AuditEnqueue | undefined;

  constructor(options: AuditAppOptions = {}) {
    this.options = options;
    this.enqueue = options.enqueue ?? auditEnqueueFromEnv();
  }

  getRetentionDays = (): number | undefined => {
    return this.options.retentionDays;
  };

  adminContribution(): AdminContribution {
    const model = createAuditEventModel(mongoose.connection, {
      retentionDays: this.options.retentionDays,
    });
    return {
      models: [
        {
          admin: {
            adminPermissions: {
              create: [],
              delete: [],
              update: [],
            },
            defaultSort: "-created",
            displayName: "Audit Log",
            listFields: ["created", "verb", "modelName", "recordLabel", "actorId"],
            readonlyFields: [
              "actorId",
              "after",
              "before",
              "created",
              "modelName",
              "operation",
              "organizationId",
              "recordId",
              "recordLabel",
              "source",
              "updated",
              "verb",
            ],
            recordTitleField: "recordLabel",
          },
          model,
          permissions: {
            create: [],
            delete: [],
            list: [Permissions.IsAdmin],
            read: [Permissions.IsAdmin],
            update: [],
          },
          routePath: "/audit-events",
        },
      ],
    };
  }

  register(app: express.Application): void {
    const model = createAuditEventModel(mongoose.connection, {
      retentionDays: this.options.retentionDays,
    });
    installAuditRecorder(model, {enqueue: this.enqueue});
    const router = modelRouter(model, {
      permissions: {
        create: [],
        delete: [],
        list: [Permissions.IsAdmin],
        read: [Permissions.IsAdmin],
        update: [],
      },
      queryFields: ["actorId", "modelName", "organizationId", "recordId", "source", "verb"],
      sort: "-created",
    });
    app.use("/audit-events", router);
    this.mountProcessQueue(app);
  }

  private mountProcessQueue = (app: express.Application): void => {
    const path = this.resolveProcessQueuePath();
    if (!path) {
      return;
    }
    const secret = this.options.processQueueSecret ?? process.env.AUDIT_TASKS_SECRET;
    if (!secret) {
      logger.error("AuditApp processQueuePath requires processQueueSecret or AUDIT_TASKS_SECRET");
      return;
    }
    app.post(
      path,
      asyncHandler(async (req, res) => {
        return handleEnqueuedAuditWrite({req, res, secret});
      })
    );
  };

  private resolveProcessQueuePath = (): string | undefined => {
    if (this.options.processQueuePath) {
      return this.options.processQueuePath;
    }
    if (this.options.enqueue === undefined && this.enqueue) {
      return DEFAULT_PROCESS_QUEUE_PATH;
    }
    return undefined;
  };
}
