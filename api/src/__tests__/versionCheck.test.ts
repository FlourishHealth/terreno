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
    expect(res.body).toEqual({status: "ok"});
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
    expect(res.body).toEqual({status: "ok"});
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
    expect(res.body).toEqual({status: "ok"});
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
});
