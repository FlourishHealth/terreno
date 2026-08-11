import {APIError, type TerrenoPlugin} from "@terreno/api";
import type express from "express";

import {CommsService} from "./commsService";
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
    addPushTokenRoutes(app, {basePath: `${basePath}/pushTokens`, openApi});
    addCommsExplorerRoute(app, {openApi, path: `${basePath}/messages`});
  }
}
