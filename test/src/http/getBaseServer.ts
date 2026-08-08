import express, {type Express} from "express";
import qs from "qs";

export interface GetBaseServerOptions {
  enableCors?: boolean;
  patchOpenApiCompat?: (app: express.Application) => void;
}

/**
 * Minimal Express app for supertest with qs query parsing (Express 5 compatible).
 */
export const getBaseServer = (options: GetBaseServerOptions = {}): Express => {
  const app = express();
  app.set("query parser", (str: string) => qs.parse(str, {arrayLimit: 200}));

  if (options.patchOpenApiCompat) {
    options.patchOpenApiCompat(app);
  }

  if (options.enableCors !== false) {
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "*");
      if (req.method === "OPTIONS") {
        res.send(200);
        return;
      }
      next();
    });
  }

  app.use(express.json());
  return app;
};
