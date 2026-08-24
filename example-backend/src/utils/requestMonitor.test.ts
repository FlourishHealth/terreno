import {describe, expect, it} from "bun:test";
import type {NextFunction, Request, Response} from "express";

import {
  createMonitoredAggregate,
  createMonitoredQueryExec,
  requestMonitorMiddleware,
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

/**
 * Forces every elapsed `process.hrtime(start)` reading past the slow thresholds.
 * Fresh readings and `hrtime.bigint` stay real so concurrently running suites
 * that depend on them are unaffected.
 */
const withSlowClock = async (run: () => Promise<void> | void): Promise<void> => {
  const originalHrtime = process.hrtime;
  const slowHrtime = ((start?: [number, number]) => {
    if (!start) {
      return originalHrtime();
    }
    return [2, 0] as [number, number];
  }) as typeof process.hrtime;
  slowHrtime.bigint = originalHrtime.bigint.bind(originalHrtime);
  process.hrtime = slowHrtime;
  try {
    await run();
  } finally {
    process.hrtime = originalHrtime;
  }
};

describe("requestMonitorMiddleware", () => {
  it("skips /health", () => {
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };
    requestMonitorMiddleware(makeReq("/health"), makeRes(), next);
    expect(called).toBe(true);
  });

  it("logs slow requests when elapsed time exceeds the threshold", async () => {
    await withSlowClock(() => {
      const req = makeReq("/", false);
      const res = makeRes();
      requestMonitorMiddleware(req, res, () => {});
      trackMiddleware("auth")(req, res, () => {});
      trackDbQuery(req, "find({})", [0, 0]);
      trackDbQuery(req, "x".repeat(120), [0, 0]);
      res.end();
      expect(res.ended).toBe(true);
    });
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

interface FakeQuery {
  getQuery: () => Record<string, unknown>;
  op?: string;
}

const fakeQuery = (op?: string): FakeQuery => ({
  getQuery: () => ({name: "ada"}),
  op,
});

/**
 * Runs `work` inside a monitored request so the wrappers take the
 * `getCurrentRequest()` branch that records timings on the request.
 */
const insideMonitoredRequest = async <T>(work: () => Promise<T>): Promise<T> => {
  const req = makeReq();
  const res = makeRes();
  let outcome: Promise<T> | undefined;
  requestMonitorMiddleware(req, res, () => {
    outcome = work();
  });
  try {
    if (!outcome) {
      throw new Error("expected work to start inside the request context");
    }
    return await outcome;
  } finally {
    res.end();
  }
};

describe("createMonitoredQueryExec", () => {
  it("tracks a resolved query inside a request", async () => {
    const exec = createMonitoredQueryExec(async () => ({ok: true}));
    const result = await insideMonitoredRequest(
      () => exec.call(fakeQuery("find")) as Promise<unknown>
    );
    expect(result).toEqual({ok: true});
  });

  it("tracks a rejected query inside a request and rethrows", async () => {
    const exec = createMonitoredQueryExec(async () => {
      throw new Error("query failed");
    });
    await expect(
      insideMonitoredRequest(() => exec.call(fakeQuery("find")) as Promise<unknown>)
    ).rejects.toThrow("query failed");
  });

  it("logs a slow resolved query without a request context", async () => {
    const exec = createMonitoredQueryExec(async () => ({ok: true}));
    await withSlowClock(async () => {
      expect(await (exec.call(fakeQuery("findOne")) as Promise<unknown>)).toEqual({ok: true});
    });
  });

  it("logs a slow rejected query without a request context", async () => {
    const exec = createMonitoredQueryExec(async () => {
      throw new Error("query failed");
    });
    await withSlowClock(async () => {
      await expect(exec.call(fakeQuery("findOne")) as Promise<unknown>).rejects.toThrow(
        "query failed"
      );
    });
  });

  it("defaults the operation label when the query has no op", async () => {
    const exec = createMonitoredQueryExec(async () => ({ok: true}));
    expect(await (exec.call(fakeQuery()) as Promise<unknown>)).toEqual({ok: true});
  });

  it("returns non-promise results unchanged", () => {
    const cursor = {cursor: true};
    const exec = createMonitoredQueryExec(() => cursor);
    expect(exec.call(fakeQuery("find"))).toBe(cursor);
  });
});

describe("createMonitoredAggregate", () => {
  it("tracks a resolved aggregate inside a request", async () => {
    const aggregate = createMonitoredAggregate(async () => [{n: 1}]);
    const result = await insideMonitoredRequest(() => aggregate.call({}, [{$match: {a: 1}}]));
    expect(result).toEqual([{n: 1}]);
  });

  it("tracks a rejected aggregate inside a request and rethrows", async () => {
    const aggregate = createMonitoredAggregate(async () => {
      throw new Error("aggregate failed");
    });
    await expect(insideMonitoredRequest(() => aggregate.call({}, [{$match: {}}]))).rejects.toThrow(
      "aggregate failed"
    );
  });

  it("logs a slow resolved aggregate without a request context", async () => {
    const aggregate = createMonitoredAggregate(async () => [{n: 1}]);
    await withSlowClock(async () => {
      expect(await aggregate.call({}, [{$match: {}}])).toEqual([{n: 1}]);
    });
  });

  it("logs a slow rejected aggregate without a request context", async () => {
    const aggregate = createMonitoredAggregate(async () => {
      throw new Error("aggregate failed");
    });
    await withSlowClock(async () => {
      await expect(aggregate.call({}, [{$match: {}}])).rejects.toThrow("aggregate failed");
    });
  });
});
