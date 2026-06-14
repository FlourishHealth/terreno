import {afterEach, beforeEach, describe, expect, it, mock, spyOn} from "bun:test";
import EventEmitter from "node:events";
import {OpenFeature} from "@openfeature/server-sdk";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  logger,
  setupAuth,
  type UserModel as UserModelType,
} from "@terreno/api";
import {getBaseServer, setupDb, UserModel} from "@terreno/api/src/tests";
import type express from "express";

import {FeatureFlag} from "../featureFlagModel";
import {FeatureFlagsApp} from "../featureFlagsApp";

class FakeChangeStream extends EventEmitter {
  public close = mock((): Promise<void> => Promise.resolve());
}

const buildAppWithLive = (options: {
  eventName?: string;
  io: {emit: ReturnType<typeof mock>};
}): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);

  const plugin = new FeatureFlagsApp({
    liveUpdates: {
      eventName: options.eventName,
      socketIoServer: () => options.io,
    },
  });
  plugin.register(app);

  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("FeatureFlagsApp live updates", () => {
  let watchSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    await setupDb();
    await FeatureFlag.deleteMany({});
  });

  afterEach(async () => {
    await FeatureFlag.deleteMany({});
    watchSpy?.mockRestore();
    await OpenFeature.clearProviders();
  });

  it("emits the default socket event and payload on change stream events", async () => {
    const stream = new FakeChangeStream();
    watchSpy = spyOn(FeatureFlag, "watch").mockReturnValue(stream as never);

    const io = {emit: mock(() => {})};
    buildAppWithLive({io});

    stream.emit("change", {fullDocument: {key: "todo-summary-card"}});

    expect(io.emit).toHaveBeenCalledWith("featureFlagsChanged", {key: "todo-summary-card"});
  });

  it("respects a custom liveUpdates.eventName", async () => {
    const stream = new FakeChangeStream();
    watchSpy = spyOn(FeatureFlag, "watch").mockReturnValue(stream as never);

    const io = {emit: mock(() => {})};
    buildAppWithLive({eventName: "flagsUpdated", io});

    stream.emit("change", {fullDocument: {key: "k"}});

    expect(io.emit).toHaveBeenCalledWith("flagsUpdated", {key: "k"});
  });

  it("logs a warn on stream error, retries once, then disables after a second error", async () => {
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => {});

    const stream1 = new FakeChangeStream();
    const stream2 = new FakeChangeStream();
    let call = 0;
    watchSpy = spyOn(FeatureFlag, "watch").mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return stream1 as never;
      }
      return stream2 as never;
    });

    const io = {emit: mock(() => {})};
    buildAppWithLive({io});

    stream1.emit("error", new Error("first"));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    stream2.emit("error", new Error("second"));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    const disabledMsg = warnSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("change stream disabled")
    );
    expect(disabledMsg).toBeDefined();

    warnSpy.mockRestore();
  });
});
