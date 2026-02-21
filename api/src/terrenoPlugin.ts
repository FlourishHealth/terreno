import type express from "express";

export interface TerrenoPlugin {
  register(app: express.Application): void;
}
