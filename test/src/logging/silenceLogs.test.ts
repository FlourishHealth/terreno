import {describe, expect, it} from "bun:test";
import winston from "winston";

import {createLogSilencer, registerLogSilencing} from "./silenceLogs";

describe("createLogSilencer", () => {
  it("captures console output and restores originals", () => {
    // biome-ignore lint/suspicious/noConsole: this test asserts console capture
    const originalLog = console.log;
    const silencer = createLogSilencer();
    // biome-ignore lint/suspicious/noConsole: this test asserts console capture
    console.log("captured-line");
    expect(silencer.getLogs().some((line) => line.includes("captured-line"))).toBe(true);
    silencer.clearLogs();
    expect(silencer.getLogs()).toEqual([]);
    silencer.restore();
    // biome-ignore lint/suspicious/noConsole: this test asserts console capture
    expect(console.log).toBe(originalLog);
  });

  it("forwards captured winston lines when showAllLogs is true", () => {
    const silencer = createLogSilencer({showAllLogs: true});
    winston.info("visible-info");
    expect(silencer.getLogs().length).toBeGreaterThan(0);
    silencer.restore();
  });

  it("silences an extra winston logger", () => {
    const extra = winston.createLogger({
      transports: [new winston.transports.Console()],
    });
    const silencer = createLogSilencer({additionalWinstonLoggers: [extra]});
    extra.info("extra-logger");
    expect(silencer.getLogs().some((line) => line.includes("extra-logger"))).toBe(true);
    silencer.restore();
  });
});

describe("registerLogSilencing", () => {
  let beforeCount = 0;
  const silencer = registerLogSilencing({
    onBeforeEach: () => {
      beforeCount += 1;
    },
  });

  it("registers lifecycle hooks without throwing", () => {
    expect(typeof silencer.reapply).toBe("function");
    expect(beforeCount).toBeGreaterThanOrEqual(0);
    silencer.restore();
  });
});
