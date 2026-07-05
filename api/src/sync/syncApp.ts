import type express from "express";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {addSyncRoutes, type SyncAppOptions} from "./routes";

/**
 * TerrenoPlugin mounting the SyncDB local-first sync HTTP routes
 * (`GET /sync/snapshot`, `GET /sync/key`). Models opt in via modelRouter's `sync`
 * option; this plugin serves the registered collections.
 *
 * Phase 2 extends this plugin with the socket mutation channel (`sync:mutate`)
 * and `sync:delta` emission via the RealtimeApp change-stream watcher.
 */
export class SyncApp implements TerrenoPlugin {
  private readonly options: SyncAppOptions;

  constructor(options: SyncAppOptions = {}) {
    this.options = options;
  }

  register(app: express.Application): void {
    addSyncRoutes(app, this.options);
  }
}
