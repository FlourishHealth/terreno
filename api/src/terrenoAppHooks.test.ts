import {describe, expect, it} from "bun:test";
import express from "express";

import {runHook} from "./terrenoAppHooks";
import type {AppHooks} from "./terrenoAppOptions";

describe("TerrenoAppHooks", () => {
  describe("runHook", () => {
    it("does nothing when hooks is undefined", async () => {
      await runHook(undefined, "onAppCreated", express());
    });

    it("does nothing when the specific hook is not defined", async () => {
      const hooks: AppHooks = {};
      await runHook(hooks, "onAppCreated", express());
    });

    it("calls a sync hook", async () => {
      let called = false;
      const hooks: AppHooks = {
        onAppCreated: () => {
          called = true;
        },
      };
      await runHook(hooks, "onAppCreated", express());
      expect(called).toBe(true);
    });

    it("calls an async hook", async () => {
      let called = false;
      const hooks: AppHooks = {
        onAppCreated: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          called = true;
        },
      };
      await runHook(hooks, "onAppCreated", express());
      expect(called).toBe(true);
    });

    it("passes arguments to the hook", async () => {
      let receivedApp: any = null;
      const app = express();
      const hooks: AppHooks = {
        onAppCreated: (a) => {
          receivedApp = a;
        },
      };
      await runHook(hooks, "onAppCreated", app);
      expect(receivedApp).toBe(app);
    });

    it("throws when hook throws", async () => {
      const hooks: AppHooks = {
        onAppCreated: () => {
          throw new Error("hook failed");
        },
      };
      expect(runHook(hooks, "onAppCreated", express())).rejects.toThrow("hook failed");
    });

    it("throws when async hook rejects", async () => {
      const hooks: AppHooks = {
        onAppCreated: async () => {
          throw new Error("async hook failed");
        },
      };
      expect(runHook(hooks, "onAppCreated", express())).rejects.toThrow("async hook failed");
    });

    it("works with onListening hook", async () => {
      let receivedPort = 0;
      const hooks: AppHooks = {
        onListening: (_server, port) => {
          receivedPort = port;
        },
      };
      const server = {} as any;
      await runHook(hooks, "onListening", server, 3000);
      expect(receivedPort).toBe(3000);
    });

    it("works with onRequest hook", async () => {
      let receivedReq: any = null;
      const hooks: AppHooks = {
        onRequest: (req) => {
          receivedReq = req;
        },
      };
      const mockReq = {method: "GET"};
      await runHook(hooks, "onRequest", mockReq, {});
      expect(receivedReq).toBe(mockReq);
    });

    it("works with onError hook", async () => {
      let receivedError: Error | undefined;
      const hooks: AppHooks = {
        onError: (error) => {
          receivedError = error;
        },
      };
      const error = new Error("test");
      await runHook(hooks, "onError", error, {}, {});
      expect(receivedError).toBe(error);
    });
  });
});
