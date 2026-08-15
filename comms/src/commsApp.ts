import {APIError, logger, type TerrenoPlugin} from "@terreno/api";
import type express from "express";

import {CommsService} from "./commsService";
import {PushToken} from "./models/pushToken";
import {addCommsExplorerRoute} from "./routes/commsExplorer";
import {addPushTokenRoutes} from "./routes/pushTokens";
import type {CommsOptions} from "./types";

export interface CommsAppOptions extends CommsOptions {
  basePath?: string;
}

let registeredCommsService: CommsService | undefined;

export const getCommsService = (): CommsService => {
  if (!registeredCommsService) {
    throw new APIError({status: 500, title: "CommsApp is not registered"});
  }
  return registeredCommsService;
};

export class CommsApp implements TerrenoPlugin {
  readonly service: CommsService;
  private readonly options: CommsAppOptions;

  constructor(options?: CommsAppOptions) {
    this.options = options ?? {};
    this.service = new CommsService(this.options);
  }

  register(app: express.Application, openApi?: unknown): void {
    const basePath = this.options.basePath ?? "/comms";
    registeredCommsService = this.service;

    // Atomic push-token registration depends on the unique token index to reject concurrent
    // claims, so build it explicitly instead of relying on Mongoose autoIndex being enabled.
    void PushToken.init().catch((error: unknown) => {
      logger.error(
        `[comms] Failed to build PushToken indexes; concurrent token registration cannot be ` +
          `rejected safely until the unique token index exists: ${String(error)}`
      );
    });

    addPushTokenRoutes(app, {basePath: `${basePath}/pushTokens`, openApi});
    addCommsExplorerRoute(app, {openApi, path: `${basePath}/messages`});
  }
}
