import type express from "express";
import mongoose from "mongoose";

import type {AdminContribution} from "../adminTypes";
import {modelRouter} from "../api";
import {Permissions} from "../permissions";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {createAuditEventModel} from "./auditEventModel";

export interface AuditAppOptions {
  /** Mongo TTL in days. Omit or 0 = forever (no TTL index). Applied in a later task. */
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
    const model = createAuditEventModel(mongoose.connection);
    return {
      models: [
        {
          admin: {
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
    const model = createAuditEventModel(mongoose.connection);
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
