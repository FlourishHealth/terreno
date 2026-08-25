import {afterEach, describe, expect, it, spyOn} from "bun:test";

import {testLogger} from "./testLogger";

const originalDebug = process.env.DEBUG_MONGO_PRELOAD;
const originalShow = process.env.SHOW_ALL_TEST_LOGS;

afterEach(() => {
  if (originalDebug === undefined) {
    Reflect.deleteProperty(process.env, "DEBUG_MONGO_PRELOAD");
  } else {
    process.env.DEBUG_MONGO_PRELOAD = originalDebug;
  }
  if (originalShow === undefined) {
    Reflect.deleteProperty(process.env, "SHOW_ALL_TEST_LOGS");
  } else {
    process.env.SHOW_ALL_TEST_LOGS = originalShow;
  }
});

describe("testLogger", () => {
  it("always logs info and warn", () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    testLogger.info("hello");
    testLogger.warn("careful");
    expect(info.mock.calls.length).toBeGreaterThan(0);
    expect(warn.mock.calls.length).toBeGreaterThan(0);
    info.mockRestore();
    warn.mockRestore();
  });

  it("debugs only when DEBUG_MONGO_PRELOAD is true", () => {
    const debug = spyOn(console, "debug").mockImplementation(() => {});
    Reflect.deleteProperty(process.env, "DEBUG_MONGO_PRELOAD");
    testLogger.debug("quiet");
    expect(debug.mock.calls.length).toBe(0);
    process.env.DEBUG_MONGO_PRELOAD = "true";
    testLogger.debug("loud");
    expect(debug.mock.calls.length).toBe(1);
    debug.mockRestore();
  });

  it("catches errors when debug or show-all logs are enabled", () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    Reflect.deleteProperty(process.env, "DEBUG_MONGO_PRELOAD");
    Reflect.deleteProperty(process.env, "SHOW_ALL_TEST_LOGS");
    testLogger.catch(new Error("silent"));
    expect(error.mock.calls.length).toBe(0);
    process.env.SHOW_ALL_TEST_LOGS = "true";
    testLogger.catch(new Error("shown"));
    expect(error.mock.calls.length).toBe(1);
    process.env.DEBUG_MONGO_PRELOAD = "true";
    testLogger.catch("also");
    expect(error.mock.calls.length).toBe(2);
    error.mockRestore();
  });
});
