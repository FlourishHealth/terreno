import {createServer, type IncomingMessage, type Server, type ServerResponse} from "node:http";

import {logger} from "@terreno/api";

const STARTING_BODY = JSON.stringify({details: {status: "starting"}, healthy: false});

/**
 * Bind `PORT` before MongoDB connect so Cloud Run's TCP startup probe can
 * succeed while the rest of boot still runs.
 */
export const bindPortEarly = async (port: string): Promise<Server> => {
  const server = createServer((_req: IncomingMessage, res: ServerResponse): void => {
    res.writeHead(503, {"Content-Type": "application/json"});
    res.end(STARTING_BODY);
  });

  await new Promise<void>((resolve, reject): void => {
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once("error", onError);
    server.listen(port, (): void => {
      server.removeListener("error", onError);
      logger.info(`Listening on port ${port} (starting)`);
      resolve();
    });
  });

  return server;
};

/**
 * Close the startup holder so a failed boot cannot keep PORT bound with 503s.
 */
export const closeEarlyListenHolder = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject): void => {
    server.close((error?: Error): void => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};
