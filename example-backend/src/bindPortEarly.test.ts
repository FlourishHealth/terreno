import {afterEach, describe, it} from "bun:test";
import type {Server} from "node:http";

import {assert} from "chai";

import {bindPortEarly, closeEarlyListenHolder} from "./bindPortEarly";

const closeServer = async (server: Server | undefined): Promise<void> => {
  if (!server) {
    return;
  }

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

describe("bindPortEarly", () => {
  let server: Server | undefined;

  afterEach(async () => {
    await closeServer(server);
    server = undefined;
  });

  it("listens before the real app is attached and serves a starting 503", async () => {
    server = await bindPortEarly("0");
    const address = server.address();
    assert.isObject(address);
    const port = (address as {port: number}).port;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 503);
    const body = (await response.json()) as {details?: {status?: string}; healthy?: boolean};
    assert.isFalse(body.healthy);
    assert.equal(body.details?.status, "starting");
  });

  it("rejects when the port is already bound", async () => {
    server = await bindPortEarly("0");
    const address = server.address();
    assert.isObject(address);
    const port = (address as {port: number}).port;
    try {
      await bindPortEarly(String(port));
      assert.fail("expected a second bind on the same port to reject");
    } catch (error) {
      assert.instanceOf(error, Error);
    }
  });

  it("releases the port so a failed boot does not keep serving 503", async () => {
    server = await bindPortEarly("0");
    const address = server.address();
    assert.isObject(address);
    const port = (address as {port: number}).port;
    await closeEarlyListenHolder(server);
    server = undefined;
    try {
      await fetch(`http://127.0.0.1:${port}/health`);
      assert.fail("expected fetch to fail after the holder closed");
    } catch (error) {
      assert.instanceOf(error, Error);
    }
  });
});
