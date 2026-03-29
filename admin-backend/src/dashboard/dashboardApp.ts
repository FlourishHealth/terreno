import {logger} from "@terreno/api";
import type express from "express";
import mongoose from "mongoose";

import type {DataSourceConfig} from "./chartTypes";
import {addDashboardRoutes} from "./dashboardRoutes";

export interface DashboardAppOptions {
  dataSources: DataSourceConfig[];
}

/**
 * TerrenoPlugin that adds dashboard CRUD routes and the query execution endpoint.
 * Mount after AdminApp so that /admin routes are already registered.
 *
 * @example
 * ```typescript
 * const dashboardApp = new DashboardApp({dataSources: [...]});
 * new TerrenoApp({userModel: User})
 *   .register(admin)
 *   .register(dashboardApp)
 *   .start();
 * ```
 */
export class DashboardApp {
  private dataSources: DataSourceConfig[];
  private supportsWindowFields = false;
  private mongodbVersion = "unknown";

  constructor(options: DashboardAppOptions) {
    this.dataSources = options.dataSources;
  }

  async register(app: express.Application): Promise<void> {
    // Detect MongoDB version at startup — default to false on failure
    try {
      const admin = mongoose.connection.db?.admin();
      if (admin) {
        const info = await admin.serverInfo();
        this.mongodbVersion = info.version ?? "unknown";
        const major = Number.parseInt(this.mongodbVersion.split(".")[0] ?? "0", 10);
        this.supportsWindowFields = major >= 5;
        logger.info(
          `DashboardApp: MongoDB ${this.mongodbVersion}, supportsWindowFields=${this.supportsWindowFields}`
        );
      }
    } catch (err) {
      logger.warn("DashboardApp: Could not detect MongoDB version, disabling window fields", {err});
      this.supportsWindowFields = false;
    }

    addDashboardRoutes(app, {
      dataSources: this.dataSources,
      mongodbVersion: this.mongodbVersion,
      supportsWindowFields: this.supportsWindowFields,
    });
  }
}
