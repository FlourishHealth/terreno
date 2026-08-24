import {afterAll, beforeAll, describe, expect, it} from "bun:test";
import type {NextFunction, Request, Response} from "express";
import mongoose from "mongoose";

import {
  requestMonitorMiddleware,
  setupMongooseMonitoring,
  trackDbQuery,
  trackMiddleware,
} from "./requestMonitor";

const makeReq = (path = "/todos", withUser = true): Request =>
  ({
    get: (header: string) => (header === "user-agent" ? "test-agent" : undefined),
    method: "GET",
    path,
    url: path,
    user: withUser ? {id: "user-1"} : undefined,
  }) as unknown as Request;

const makeRes = (): Response & {ended: boolean} => {
  const res = {
    end: (..._args: unknown[]) => {
      res.ended = true;
      return res;
    },
    ended: false,
    statusCode: 200,
  };
  return res as unknown as Response & {ended: boolean};
};

const originalQueryExec = mongoose.Query.prototype.exec;
const originalAggregate = mongoose.Model.aggregate;

describe("requestMonitorMiddleware", () => {
  it("skips /health", () => {
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };
    requestMonitorMiddleware(makeReq("/health"), makeRes(), next);
    expect(called).toBe(true);
  });

  it("logs slow requests when elapsed time exceeds the threshold", () => {
    const originalHrtime = process.hrtime.bind(process);
    process.hrtime = ((start?: [number, number]) => {
      if (!start) {
        return [0, 0] as [number, number];
      }
      return [2, 0] as [number, number];
    }) as typeof process.hrtime;
    try {
      const req = makeReq("/", false);
      const res = makeRes();
      requestMonitorMiddleware(req, res, () => {});
      trackMiddleware("auth")(req, res, () => {});
      trackDbQuery(req, "find({})", [0, 0]);
      trackDbQuery(req, "x".repeat(120), [0, 0]);
      res.end();
      expect(res.ended).toBe(true);
    } finally {
      process.hrtime = originalHrtime;
    }
  });

  it("records memory snapshots while a request is in flight", async () => {
    const req = makeReq();
    const res = makeRes();
    requestMonitorMiddleware(req, res, () => {});
    await new Promise((resolve) => setTimeout(resolve, 600));
    res.end();
    expect(res.ended).toBe(true);
  });

  it("does not record timings for unmonitored requests", () => {
    const req = makeReq();
    const res = makeRes();
    trackMiddleware("auth")(req, res, () => {});
    trackDbQuery(req, "find", process.hrtime());
    expect(true).toBe(true);
  });
});

describe("setupMongooseMonitoring", () => {
  beforeAll(() => {
    mongoose.Query.prototype.exec = function (this: {
      getQuery: () => Record<string, unknown>;
      op?: string;
      reject?: boolean;
      syncValue?: unknown;
    }) {
      if (this.syncValue !== undefined) {
        return this.syncValue;
      }
      if (this.reject) {
        return Promise.reject(new Error("query failed"));
      }
      return Promise.resolve({ok: true});
    } as typeof mongoose.Query.prototype.exec;

    mongoose.Model.aggregate = function (this: {reject?: boolean}, _pipeline?: unknown) {
      if (this.reject) {
        return Promise.reject(new Error("aggregate failed"));
      }
      return Promise.resolve([{n: 1}]);
    } as typeof mongoose.Model.aggregate;

    setupMongooseMonitoring();
  });

  afterAll(() => {
    mongoose.Query.prototype.exec = originalQueryExec;
    mongoose.Model.aggregate = originalAggregate;
  });

  const runQueryInsideRequest = async (queryThis: {
    getQuery: () => Record<string, unknown>;
    op?: string;
    reject?: boolean;
    syncValue?: unknown;
  }): Promise<unknown> => {
    const req = makeReq();
    const res = makeRes();
    let result: unknown;
    let error: unknown;
    requestMonitorMiddleware(req, res, () => {
      const pending = mongoose.Query.prototype.exec.call(queryThis);
      if (pending && typeof (pending as Promise<unknown>).then === "function") {
        return (pending as Promise<unknown>)
          .then((value) => {
            result = value;
          })
          .catch((err: unknown) => {
            error = err;
          })
          .finally(() => {
            res.end();
          });
      }
      result = pending;
      res.end();
      return undefined;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (error) {
      throw error;
    }
    return result;
  };

  it("tracks successful Query.exec inside a request", async () => {
    const result = await runQueryInsideRequest({
      getQuery: () => ({name: "ada"}),
      op: "find",
    });
    expect(result).toEqual({ok: true});
  });

  it("logs slow Query.exec without a request context", async () => {
    const originalHrtime = process.hrtime.bind(process);
    process.hrtime = ((start?: [number, number]) => {
      if (!start) {
        return [0, 0] as [number, number];
      }
      return [1, 0] as [number, number];
    }) as typeof process.hrtime;
    try {
      const value = await mongoose.Query.prototype.exec.call({
        getQuery: () => ({slow: true}),
        op: "findOne",
      });
      expect(value).toEqual({ok: true});
    } finally {
      process.hrtime = originalHrtime;
    }
  });

  it("tracks rejected Query.exec inside a request", async () => {
    try {
      await runQueryInsideRequest({
        getQuery: () => ({name: "err"}),
        op: "find",
        reject: true,
      });
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toBe("query failed");
    }
  });

  it("logs slow rejected Query.exec without a request context", async () => {
    const originalHrtime = process.hrtime.bind(process);
    process.hrtime = ((start?: [number, number]) => {
      if (!start) {
        return [0, 0] as [number, number];
      }
      return [1, 0] as [number, number];
    }) as typeof process.hrtime;
    try {
      await mongoose.Query.prototype.exec.call({
        getQuery: () => ({slow: true}),
        op: "findOne",
        reject: true,
      });
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toBe("query failed");
    } finally {
      process.hrtime = originalHrtime;
    }
  });

  it("returns non-promise Query.exec results unchanged", () => {
    const value = mongoose.Query.prototype.exec.call({
      getQuery: () => ({}),
      op: "find",
      syncValue: {cursor: true},
    }) as unknown;
    expect(value).toEqual({cursor: true});
  });

  it("tracks successful Model.aggregate inside a request", async () => {
    const req = makeReq();
    const res = makeRes();
    let result: unknown;
    requestMonitorMiddleware(req, res, () => {
      void mongoose.Model.aggregate.call({}, [{$match: {active: true}}]).then((value: unknown) => {
        result = value;
        res.end();
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result).toEqual([{n: 1}]);
  });

  it("logs slow Model.aggregate without a request context", async () => {
    const originalHrtime = process.hrtime.bind(process);
    process.hrtime = ((start?: [number, number]) => {
      if (!start) {
        return [0, 0] as [number, number];
      }
      return [1, 0] as [number, number];
    }) as typeof process.hrtime;
    try {
      const value = await mongoose.Model.aggregate.call({}, [{$match: {}}]);
      expect(value).toEqual([{n: 1}]);
    } finally {
      process.hrtime = originalHrtime;
    }
  });

  it("tracks rejected Model.aggregate inside a request", async () => {
    const req = makeReq();
    const res = makeRes();
    let message = "";
    requestMonitorMiddleware(req, res, () => {
      void mongoose.Model.aggregate.call({reject: true}, [{$match: {}}]).catch((error: Error) => {
        message = error.message;
        res.end();
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(message).toBe("aggregate failed");
  });

  it("logs slow rejected Model.aggregate without a request context", async () => {
    const originalHrtime = process.hrtime.bind(process);
    process.hrtime = ((start?: [number, number]) => {
      if (!start) {
        return [0, 0] as [number, number];
      }
      return [1, 0] as [number, number];
    }) as typeof process.hrtime;
    try {
      await mongoose.Model.aggregate.call({reject: true}, [{$match: {}}]);
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toBe("aggregate failed");
    } finally {
      process.hrtime = originalHrtime;
    }
  });
});
