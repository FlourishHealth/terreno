import type express from "express";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {setSyncMutationScopeResolver} from "./mutationHandler";
import {addSyncRoutes, type SyncAppOptions} from "./routes";

const SYNC_APP_OPTIONS_LOCAL_KEY = "terrenoSyncAppOptions";

/** Resolve the SyncApp configuration attached to one Express application. */
export const getSyncAppOptions = (app: express.Application): SyncAppOptions | undefined =>
  app.locals[SYNC_APP_OPTIONS_LOCAL_KEY] as SyncAppOptions | undefined;

/**
 * TerrenoPlugin mounting the SyncDB local-first sync HTTP routes
 * (`GET /sync/snapshot`, `POST /sync/mutate`, `GET /sync/key`). Models opt in via
 * modelRouter's `sync` option; this plugin serves the registered collections.
 *
 * Registration attaches the plugin's options (notably `getUserScopes`) to this Express
 * application so RealtimeApp's connection handler can install the socket
 * mutation/subscription channel (`sync:subscribe`, `sync:mutate`) with the same
 * configuration — the socket layer requires both plugins: SyncApp for config/routes and
 * RealtimeApp for the Socket.io server and `sync:delta` emission.
 */
export class SyncApp implements TerrenoPlugin {
  private readonly options: SyncAppOptions;

  constructor(options: SyncAppOptions = {}) {
    this.options = options;
  }

  register(app: express.Application): void {
    app.locals[SYNC_APP_OPTIONS_LOCAL_KEY] = this.options;
    // C6: the mutation-scope backstop resolves tenant memberships via the same resolver.
    setSyncMutationScopeResolver(this.options.getUserScopes);
    addSyncRoutes(app, this.options);
  }
}
