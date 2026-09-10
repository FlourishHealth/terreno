import {describe, expect, it} from "bun:test";

import {getBaseServer} from "./getBaseServer";

describe("getBaseServer", () => {
  it("creates an express app with json parsing enabled", async () => {
    const app = getBaseServer();
    app.get("/ping", (req, res) => {
      res.json({ok: true, query: req.query});
    });

    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const pingResponse = await fetch(`http://127.0.0.1:${port}/ping?foo=bar&arr=1&arr=2`);
    expect(pingResponse.status).toBe(200);
    await pingResponse.json();

    const optionsResponse = await fetch(`http://127.0.0.1:${port}/ping`, {method: "OPTIONS"});
    expect(optionsResponse.status).toBe(200);

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

  it("skips CORS and applies an OpenAPI compat patch", () => {
    let patched = false;
    const app = getBaseServer({
      enableCors: false,
      patchOpenApiCompat: () => {
        patched = true;
      },
    });
    expect(patched).toBe(true);
    expect(app).toBeDefined();
  });
});
