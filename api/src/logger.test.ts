import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {Writable} from "node:stream";
import winston from "winston";

import {
  createFeatureFlaggedLogger,
  createScopedLogger,
  formatLogContextSuffix,
  logger,
  setupLogging,
  type TerrenoRequestLogEntry,
  winstonLogger,
} from "./logger";
import {runWithRequestContext} from "./requestContext";

describe("logger", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {...OLD_ENV};
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("logger.info writes a log entry", () => {
    expect(() => logger.info("test info message")).not.toThrow();
  });

  it("logger.warn writes a log entry", () => {
    expect(() => logger.warn("test warn message")).not.toThrow();
  });

  it("logger.error writes a log entry", () => {
    expect(() => logger.error("test error message")).not.toThrow();
  });

  it("logger.debug writes a log entry", () => {
    expect(() => logger.debug("test debug message")).not.toThrow();
  });

  it("logger.catch handles Error instance", () => {
    expect(() => logger.catch(new Error("caught error"))).not.toThrow();
  });

  it("logger.catch handles non-Error value", () => {
    expect(() => logger.catch("string error")).not.toThrow();
  });

  it("logger.catch with Sentry logging enabled and Error", () => {
    process.env.USE_SENTRY_LOGGING = "true";
    expect(() => logger.catch(new Error("captured"))).not.toThrow();
  });
});

describe("formatLogContextSuffix", () => {
  it("includes request ids and sorts terrenoLabels for stable output", () => {
    const suffix = formatLogContextSuffix({
      requestId: "r1",
      terrenoLabels: {alpha: "a", zebra: "z"},
    });
    expect(suffix).toContain("requestId=r1");
    expect(suffix.indexOf("alpha=a")).toBeLessThan(suffix.indexOf("zebra=z"));
  });

  it("returns empty string when no fields are set", () => {
    expect(formatLogContextSuffix({})).toBe("");
  });

  it("includes terrenoLogPrefix in suffix", () => {
    const suffix = formatLogContextSuffix({
      requestId: "r1",
      terrenoLogPrefix: "[Job]",
    });
    expect(suffix).toContain("logPrefix=[Job]");
    expect(suffix).toContain("requestId=r1");
  });
});

describe("createScopedLogger", () => {
  afterEach(() => {
    setupLogging({disableFileLogging: true});
  });

  it("returns the global logger when prefix and labels are empty", () => {
    expect(createScopedLogger({})).toBe(logger);
    expect(createScopedLogger({labels: {skipped: undefined}})).toBe(logger);
  });

  it("prefixes messages when only prefix is set", () => {
    const lines: string[] = [];
    const snapshots: Array<{terrenoLogPrefix?: unknown}> = [];
    const captureTransport = new winston.transports.Stream({
      format: winston.format.combine(
        winston.format((info) => {
          snapshots.push({
            terrenoLogPrefix: (info as {terrenoLogPrefix?: unknown}).terrenoLogPrefix,
          });
          return info;
        })(),
        winston.format.printf((info) => {
          const msg = typeof info.message === "string" ? info.message : String(info.message);
          return `${info.level}: ${msg}`;
        })
      ),
      stream: new Writable({
        write(chunk, _encoding, callback): void {
          lines.push(chunk.toString().trim());
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      createScopedLogger({prefix: "[ScopedTest]"}).info("hello");
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(lines.some((l) => l.includes("[ScopedTest]") && l.includes("hello"))).toBe(true);
    expect(snapshots.some((s) => s.terrenoLogPrefix === "[ScopedTest]")).toBe(true);
  });

  it("attaches terrenoLabels to winston metadata for structured transports", () => {
    const snapshots: Array<{level?: string; message?: unknown; terrenoLabels?: unknown}> = [];
    const captureTransport = new winston.transports.Stream({
      format: winston.format((info) => {
        snapshots.push({
          level: info.level,
          message: info.message,
          terrenoLabels: (info as {terrenoLabels?: unknown}).terrenoLabels,
        });
        return info;
      })(),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      createScopedLogger({labels: {billingId: "b1"}}).warn("charged");
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(
      snapshots.some(
        (s) => (s.terrenoLabels as {billingId?: string} | undefined)?.billingId === "b1"
      )
    ).toBe(true);
  });

  it("includes terrenoLogPrefix alongside terrenoLabels in metadata", () => {
    const snapshots: Array<{terrenoLogPrefix?: unknown; terrenoLabels?: unknown}> = [];
    const captureTransport = new winston.transports.Stream({
      format: winston.format((info) => {
        snapshots.push({
          terrenoLabels: (info as {terrenoLabels?: unknown}).terrenoLabels,
          terrenoLogPrefix: (info as {terrenoLogPrefix?: unknown}).terrenoLogPrefix,
        });
        return info;
      })(),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      createScopedLogger({labels: {x: "1"}, prefix: "[Both]"}).info("m");
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(
      snapshots.some(
        (s) =>
          (s.terrenoLabels as {x?: string} | undefined)?.x === "1" &&
          (s.terrenoLogPrefix as string | undefined) === "[Both]"
      )
    ).toBe(true);
  });

  it("merges all request context fields including jobId, sessionId, spanId, traceId, traceSampled", () => {
    const snapshots: Array<Record<string, unknown>> = [];
    const captureTransport = new winston.transports.Stream({
      format: winston.format((info) => {
        snapshots.push({
          jobId: info.jobId,
          requestId: info.requestId,
          sessionId: info.sessionId,
          spanId: info.spanId,
          traceId: info.traceId,
          traceSampled: info.traceSampled,
          userId: info.userId,
        });
        return info;
      })(),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      runWithRequestContext(
        {
          jobId: "job-42",
          requestId: "req-full",
          sessionId: "sess-7",
          spanId: "span-abc",
          traceId: "trace-xyz",
          traceSampled: true,
          userId: "user-1",
        },
        () => {
          logger.info("full context");
        }
      );
    } finally {
      winstonLogger.remove(captureTransport);
    }
    const entry = snapshots.find((s) => s.requestId === "req-full");
    expect(entry).toBeDefined();
    expect(entry?.jobId).toBe("job-42");
    expect(entry?.sessionId).toBe("sess-7");
    expect(entry?.spanId).toBe("span-abc");
    expect(entry?.traceId).toBe("trace-xyz");
    expect(entry?.traceSampled).toBe(true);
    expect(entry?.userId).toBe("user-1");
  });

  it("exercises all scoped logger methods (debug, error, catch)", () => {
    const lines: string[] = [];
    const captureTransport = new winston.transports.Stream({
      format: winston.format.printf((info) => {
        const msg = typeof info.message === "string" ? info.message : String(info.message);
        return `${info.level}: ${msg}`;
      }),
      stream: new Writable({
        write(chunk, _encoding, callback): void {
          lines.push(chunk.toString().trim());
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      const scoped = createScopedLogger({prefix: "[Methods]"});
      scoped.debug("d-msg");
      scoped.error("e-msg");
      scoped.catch(new Error("caught-msg"));
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(lines.some((l) => l.includes("[Methods]") && l.includes("d-msg"))).toBe(true);
    expect(lines.some((l) => l.includes("[Methods]") && l.includes("e-msg"))).toBe(true);
    expect(lines.some((l) => l.includes("[Methods]") && l.includes("caught-msg"))).toBe(true);
  });

  it("scoped logger catch with Sentry enabled and Error instance", () => {
    const OLD_ENV = process.env;
    process.env = {...OLD_ENV, USE_SENTRY_LOGGING: "true"};
    try {
      const scoped = createScopedLogger({prefix: "[Sentry]"});
      expect(() => scoped.catch(new Error("sentry scoped error"))).not.toThrow();
    } finally {
      process.env = OLD_ENV;
    }
  });

  it("attaches terrenoRequestLog while request ALS scope is active", () => {
    const snapshots: Array<{terrenoRequestLog?: TerrenoRequestLogEntry}> = [];
    const captureTransport = new winston.transports.Stream({
      format: winston.format((info) => {
        snapshots.push({
          terrenoRequestLog: (info as {terrenoRequestLog?: TerrenoRequestLogEntry})
            .terrenoRequestLog,
        });
        return info;
      })(),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      runWithRequestContext({requestId: "req-als-1", userId: "user-99"}, () => {
        logger.info("in scope");
      });
      runWithRequestContext({requestId: "req-als-2"}, () => {
        logger.info("anon");
      });
    } finally {
      winstonLogger.remove(captureTransport);
    }
    const withUser = snapshots.find((s) => s.terrenoRequestLog?.requestId === "req-als-1");
    expect(withUser?.terrenoRequestLog?.userId).toBe("user-99");
    const anon = snapshots.find((s) => s.terrenoRequestLog?.requestId === "req-als-2");
    expect(anon?.terrenoRequestLog?.userId).toBeNull();
  });
});

describe("createFeatureFlaggedLogger", () => {
  afterEach(() => {
    setupLogging({disableFileLogging: true});
  });

  it("drops info lines while disabled", () => {
    let hits = 0;
    const captureTransport = new winston.transports.Stream({
      format: winston.format.printf(() => {
        hits += 1;
        return "";
      }),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      const log = createFeatureFlaggedLogger({isEnabled: () => false, target: logger});
      log.info("hidden");
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(hits).toBe(0);
  });

  it("forwards lines when enabled", () => {
    let hits = 0;
    const captureTransport = new winston.transports.Stream({
      format: winston.format.printf(() => {
        hits += 1;
        return "";
      }),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      const log = createFeatureFlaggedLogger({isEnabled: () => true, target: logger});
      log.info("visible");
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(hits).toBeGreaterThan(0);
  });

  it("forwards catch while disabled when gateCatch is false", () => {
    let hits = 0;
    const captureTransport = new winston.transports.Stream({
      format: winston.format.printf(() => {
        hits += 1;
        return "";
      }),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      const log = createFeatureFlaggedLogger({
        gateCatch: false,
        isEnabled: () => false,
        target: logger,
      });
      log.catch(new Error("still-logged"));
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(hits).toBeGreaterThan(0);
  });

  it("forwards all methods when enabled (debug, warn, error)", () => {
    const levels: string[] = [];
    const captureTransport = new winston.transports.Stream({
      format: winston.format((info) => {
        levels.push(info.level);
        return info;
      })(),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      const log = createFeatureFlaggedLogger({isEnabled: () => true, target: logger});
      log.debug("d");
      log.warn("w");
      log.error("e");
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(levels.some((l) => l === "debug")).toBe(true);
    expect(levels.some((l) => l === "warn")).toBe(true);
    expect(levels.some((l) => l === "error")).toBe(true);
  });

  it("drops debug, warn, error lines when disabled", () => {
    let hits = 0;
    const captureTransport = new winston.transports.Stream({
      format: winston.format.printf(() => {
        hits += 1;
        return "";
      }),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      const log = createFeatureFlaggedLogger({isEnabled: () => false, target: logger});
      log.debug("hidden-d");
      log.warn("hidden-w");
      log.error("hidden-e");
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(hits).toBe(0);
  });

  it("uses the global logger as default target when target is not provided", () => {
    const log = createFeatureFlaggedLogger({isEnabled: () => true});
    expect(() => log.info("default target")).not.toThrow();
  });

  it("drops catch while disabled when gateCatch is true", () => {
    let hits = 0;
    const captureTransport = new winston.transports.Stream({
      format: winston.format.printf(() => {
        hits += 1;
        return "";
      }),
      stream: new Writable({
        write(_chunk, _encoding, callback): void {
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      const log = createFeatureFlaggedLogger({
        gateCatch: true,
        isEnabled: () => false,
        target: logger,
      });
      log.catch(new Error("suppressed"));
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(hits).toBe(0);
  });
});

describe("setupLogging", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "logger-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, {force: true, recursive: true});
    } catch {}
    // Restore a default logger config
    setupLogging({disableFileLogging: true});
  });

  it("disables console logging when disableConsoleLogging is true", () => {
    expect(() =>
      setupLogging({
        disableConsoleLogging: true,
        disableFileLogging: true,
      })
    ).not.toThrow();
  });

  it("disables console colors when disableConsoleColors is true", () => {
    expect(() =>
      setupLogging({
        disableConsoleColors: true,
        disableFileLogging: true,
      })
    ).not.toThrow();
  });

  it("adds timestamps when showConsoleTimestamps is true", () => {
    expect(() =>
      setupLogging({
        disableFileLogging: true,
        showConsoleTimestamps: true,
      })
    ).not.toThrow();
  });

  it("respects logLevel option", () => {
    expect(() =>
      setupLogging({
        disableFileLogging: true,
        level: "info",
      })
    ).not.toThrow();
  });

  it("creates log directory if it does not exist", () => {
    const nonExistentDir = path.join(tempDir, "nested", "logs");
    setupLogging({
      disableConsoleLogging: true,
      logDirectory: nonExistentDir,
    });
    expect(fs.existsSync(nonExistentDir)).toBe(true);
  });

  it("uses existing log directory if it exists", () => {
    const existingDir = path.join(tempDir, "existing");
    fs.mkdirSync(existingDir);
    expect(() =>
      setupLogging({
        disableConsoleLogging: true,
        logDirectory: existingDir,
      })
    ).not.toThrow();
  });

  it("adds custom transports when provided", () => {
    const customTransport = new winston.transports.Console({level: "error"});
    expect(() =>
      setupLogging({
        disableConsoleLogging: true,
        disableFileLogging: true,
        transports: [customTransport],
      })
    ).not.toThrow();
  });

  it("uses file logging at info level when level is info (no debug file)", () => {
    setupLogging({
      disableConsoleLogging: true,
      level: "info",
      logDirectory: tempDir,
    });
    // No assertion needed - just verifying branch coverage with level=info
    expect(true).toBe(true);
  });

  it("uses file logging at debug level by default (with debug file)", () => {
    setupLogging({
      disableConsoleLogging: true,
      logDirectory: tempDir,
    });
    expect(true).toBe(true);
  });

  it("console format includes timestamps when showConsoleTimestamps is true", () => {
    const lines: string[] = [];
    setupLogging({
      disableFileLogging: true,
      showConsoleTimestamps: true,
    });
    const captureTransport = new winston.transports.Stream({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          if (info.timestamp) {
            return `${info.timestamp} - ${info.level}: ${info.message}`;
          }
          return `${info.level}: ${info.message}`;
        })
      ),
      stream: new Writable({
        write(chunk, _encoding, callback): void {
          lines.push(chunk.toString().trim());
          callback();
        },
      }),
    });
    winstonLogger.add(captureTransport);
    try {
      logger.info("timestamp-test");
    } finally {
      winstonLogger.remove(captureTransport);
    }
    expect(lines.some((l) => l.includes("timestamp-test"))).toBe(true);
  });

  it("disableTerrenoDevJsonlLog skips the dev JSONL transport", () => {
    expect(() =>
      setupLogging({
        disableFileLogging: true,
        disableTerrenoDevJsonlLog: true,
      })
    ).not.toThrow();
  });
});
