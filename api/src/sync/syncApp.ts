import type express from "express";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {setSyncMutationScopeResolver} from "./mutationHandler";
import {addSyncRoutes, type SyncAppOptions} from "./routes";
import {setActiveSyncAppOptions} from "./socketHandlers";

/**
 * TerrenoPlugin mounting the SyncDB local-first sync HTTP routes
 * (`GET /sync/snapshot`, `POST /sync/mutate`, `GET /sync/key`). Models opt in via
 * modelRouter's `sync` option; this plugin serves the registered collections.
 *
 * Registration also publishes the plugin's options (notably `getUserScopes`) as the
 * active SyncAppOptions so RealtimeApp's connection handler can install the socket
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
    setActiveSyncAppOptions(this.options);
    // C6: the mutation-scope backstop resolves tenant memberships via the same resolver.
    setSyncMutationScopeResolver(this.options.getUserScopes);
    addSyncRoutes(app, this.options);
  }
}
