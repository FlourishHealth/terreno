import {describe, expect, it} from "bun:test";

import {getBaseServer} from "./getBaseServer";

describe("getBaseServer", () => {
  it("creates an express app with json parsing enabled", async () => {
    const app = getBaseServer();
    app.get("/ping", (_req, res) => {
      res.json({ok: true});
    });

    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/ping`);
    expect(response.status).toBe(200);
    await response.json();

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });
});
