import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

export interface HealthCheckResult {
  healthy: boolean;
  details?: Record<string, any>;
}

export interface HealthOptions {
  enabled?: boolean;
  path?: string;
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

export class HealthApp implements TerrenoPlugin {
  private options: HealthOptions;

  constructor(options?: HealthOptions) {
    this.options = options ?? {};
  }

  register(app: express.Application): void {
    if (this.options.enabled === false) {
      return;
    }
    const path = this.options.path ?? "/health";
    const checkFn = this.options.check;

    app.get(path, async (_req, res) => {
      if (checkFn) {
        try {
          const result = await checkFn();
          const status = result.healthy ? 200 : 503;
          return res.status(status).json(result);
        } catch (error) {
          return res.status(503).json({
            details: {error: (error as Error).message},
            healthy: false,
          });
        }
      }
      return res.json({healthy: true});
    });
  }
}
