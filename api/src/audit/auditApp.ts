import type express from "express";
import mongoose from "mongoose";

import type {AdminContribution} from "../adminTypes";
import {modelRouter} from "../api";
import {Permissions} from "../permissions";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {createAuditEventModel} from "./auditEventModel";
import {installAuditRecorder} from "./record";

export interface AuditAppOptions {
  /** Mongo TTL in days. Omit or 0 = forever (no TTL index). */
  retentionDays?: number;
}

export class AuditApp implements TerrenoPlugin {
  private readonly options: AuditAppOptions;

  constructor(options: AuditAppOptions = {}) {
    this.options = options;
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
    installAuditRecorder(model);
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
  }
}
