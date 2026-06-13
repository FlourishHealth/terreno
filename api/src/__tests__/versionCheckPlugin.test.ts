// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import supertest from "supertest";
import {VersionConfig} from "../models/versionConfig";
import {TerrenoApp} from "../terrenoApp";
import {setupDb, UserModel} from "../tests";
import {VersionCheckPlugin} from "../versionCheckPlugin";

describe("VersionCheckPlugin", () => {
  let app: ReturnType<typeof supertest>;

  beforeEach(async () => {
    await setupDb();
    await VersionConfig.deleteMany({});

    const expressApp = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    })
      .register(new VersionCheckPlugin())
      .build();

    app = supertest(expressApp);
  });

  afterEach(async () => {
    await VersionConfig.deleteMany({});
  });

  it("returns ok when no VersionConfig exists", async () => {
    const res = await app.get("/version-check").query({platform: "web", version: 100});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({pollingIntervalMs: 86400000, status: "ok"});
  });

  it("returns ok when version param is missing", async () => {
    const res = await app.get("/version-check");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({status: "ok"});
  });

  it("returns ok when version param is invalid", async () => {
    const res = await app.get("/version-check").query({platform: "web", version: "invalid"});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({status: "ok"});
  });

  it("returns ok when client version >= warning and required (web)", async () => {
    await VersionConfig.create({
      webRequiredVersion: 50,
      webWarningVersion: 100,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 150});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      pollingIntervalMs: 86400000,
      requiredVersion: 50,
      status: "ok",
      warningVersion: 100,
    });
  });

  it("returns warning when client version < warning (web)", async () => {
    await VersionConfig.create({
      warningMessage: "Please update!",
      webRequiredVersion: 50,
      webWarningVersion: 100,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 80});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("warning");
    expect(res.body.message).toBe("Please update!");
  });

  it("returns required when client version < required (web)", async () => {
    await VersionConfig.create({
      requiredMessage: "Update required",
      updateUrl: "https://example.com/update",
      webRequiredVersion: 100,
      webWarningVersion: 150,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 50});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("required");
    expect(res.body.message).toBe("Update required");
    expect(res.body.updateUrl).toBe("https://example.com/update");
  });

  it("uses mobile thresholds when platform is mobile", async () => {
    await VersionConfig.create({
      mobileRequiredVersion: 200,
      mobileWarningVersion: 250,
      webRequiredVersion: 50,
      webWarningVersion: 80,
    });

    const webRes = await app.get("/version-check").query({platform: "web", version: 100});
    expect(webRes.body.status).toBe("ok");

    const mobileRes = await app.get("/version-check").query({platform: "mobile", version: 100});
    expect(mobileRes.body.status).toBe("required");
  });

  it("defaults to web when platform is invalid", async () => {
    await VersionConfig.create({
      webRequiredVersion: 100,
      webWarningVersion: 150,
    });

    const res = await app.get("/version-check").query({platform: "invalid", version: 50});
    expect(res.body.status).toBe("required");
  });

  it("version equal to threshold returns ok (not warning)", async () => {
    await VersionConfig.create({
      webRequiredVersion: 50,
      webWarningVersion: 100,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 100});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      pollingIntervalMs: 86400000,
      requiredVersion: 50,
      status: "ok",
      warningVersion: 100,
    });
  });

  it("returns pollingIntervalMs from config pollingIntervalMinutes", async () => {
    await VersionConfig.create({
      pollingIntervalMinutes: 60,
      webRequiredVersion: 0,
      webWarningVersion: 0,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 100});
    expect(res.status).toBe(200);
    expect(res.body.pollingIntervalMs).toBe(3600000);
  });

  it("returns default pollingIntervalMs (86400000) when pollingIntervalMinutes not set", async () => {
    await VersionConfig.create({
      webRequiredVersion: 0,
      webWarningVersion: 0,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 100});
    expect(res.status).toBe(200);
    expect(res.body.pollingIntervalMs).toBe(86400000);
  });

  it("handles numeric version parameter directly", async () => {
    await VersionConfig.create({
      webRequiredVersion: 100,
      webWarningVersion: 150,
    });

    const res = await app.get("/version-check?version=50&platform=web");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("required");
  });

  it("returns default warning message when warningMessage not set", async () => {
    await VersionConfig.create({
      webRequiredVersion: 0,
      webWarningVersion: 100,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 50});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("warning");
    expect(res.body.message).toBe(
      "A new version is available. Please update for the best experience."
    );
  });

  it("returns default required message when requiredMessage not set", async () => {
    await VersionConfig.create({
      webRequiredVersion: 100,
      webWarningVersion: 150,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 50});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("required");
    expect(res.body.message).toBe(
      "This version is no longer supported. Please update to continue."
    );
  });

  it("version equal to required returns warning not required", async () => {
    await VersionConfig.create({
      webRequiredVersion: 100,
      webWarningVersion: 150,
    });

    const res = await app.get("/version-check").query({platform: "web", version: 100});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("warning");
  });

  it("uses default messages when warningMessage/requiredMessage are not set", async () => {
    await VersionConfig.create({
      webRequiredVersion: 100,
      webWarningVersion: 200,
    });

    const warningRes = await app.get("/version-check").query({platform: "web", version: 150});
    expect(warningRes.body.status).toBe("warning");
    expect(warningRes.body.message).toBe(
      "A new version is available. Please update for the best experience."
    );

    const requiredRes = await app.get("/version-check").query({platform: "web", version: 50});
    expect(requiredRes.body.status).toBe("required");
    expect(requiredRes.body.message).toBe(
      "This version is no longer supported. Please update to continue."
    );
  });

  it("handles numeric version parameter", async () => {
    const res = await app.get("/version-check?version=50&platform=web");
    expect(res.status).toBe(200);
  });
});

describe("VersionCheckPlugin direct usage", () => {
  it("can be instantiated and register called directly on an express app", async () => {
    const express = require("express");
    const plugin = new VersionCheckPlugin();
    expect(plugin).toBeDefined();
    expect(plugin).toBeInstanceOf(VersionCheckPlugin);
    expect(typeof plugin.register).toBe("function");

    const expressApp = express();
    plugin.register(expressApp);

    const testApp = supertest(expressApp);
    const res = await testApp.get("/version-check");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("handles a numeric version query parameter", async () => {
    await setupDb();
    await VersionConfig.deleteMany({});

    const express = require("express");
    const expressApp = express();

    // Use a custom query parser that coerces numeric strings to numbers so we
    // exercise the `typeof versionParam === "number"` branch.
    expressApp.set("query parser", (qs: string) => {
      const params: Record<string, string | number> = {};
      for (const pair of qs.split("&")) {
        const [key, val] = pair.split("=");
        if (val !== undefined && /^\d+$/.test(val)) {
          params[decodeURIComponent(key)] = Number(val);
        } else {
          params[decodeURIComponent(key)] = decodeURIComponent(val ?? "");
        }
      }
      return params;
    });

    const plugin = new VersionCheckPlugin();
    plugin.register(expressApp);

    await VersionConfig.create({
      webRequiredVersion: 100,
      webWarningVersion: 150,
    });

    const testApp = supertest(expressApp);
    const res = await testApp.get("/version-check?version=50&platform=web");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("required");
  });
});
