import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import supertest from "supertest";
import {VersionConfig} from "./models/versionConfig";
import {TerrenoApp} from "./terrenoApp";
import {UserModel} from "./tests";
import {computeVersionCheck} from "./versionCheck";

describe("computeVersionCheck", () => {
  it("returns ok when config is null", () => {
    expect(computeVersionCheck(null, 1, "web")).toEqual({status: "ok"});
    expect(computeVersionCheck(null, 100, "mobile")).toEqual({status: "ok"});
  });

  it("returns ok when all version thresholds are 0", () => {
    const config = {
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Required",
      warningMessage: "Warning",
      webRequiredVersion: 0,
      webWarningVersion: 0,
    };
    expect(computeVersionCheck(config, 1, "web")).toEqual({status: "ok"});
    expect(computeVersionCheck(config, 1, "mobile")).toEqual({status: "ok"});
  });

  it("returns required when version < requiredVersion (web)", () => {
    const config = {
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Required",
      updateUrl: "https://example.com",
      warningMessage: "Warning",
      webRequiredVersion: 10,
      webWarningVersion: 50,
    };
    const result = computeVersionCheck(config, 5, "web");
    expect(result.status).toBe("required");
    expect(result.message).toBe("Required");
    expect(result.updateUrl).toBe("https://example.com");
  });

  it("returns required when version < requiredVersion (mobile)", () => {
    const config = {
      mobileRequiredVersion: 20,
      mobileWarningVersion: 50,
      requiredMessage: "Required",
      warningMessage: "Warning",
      webRequiredVersion: 0,
      webWarningVersion: 0,
    };
    const result = computeVersionCheck(config, 10, "mobile");
    expect(result.status).toBe("required");
    expect(result.message).toBe("Required");
  });

  it("returns warning when version >= requiredVersion but < warningVersion", () => {
    const config = {
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Required",
      warningMessage: "Please update",
      webRequiredVersion: 10,
      webWarningVersion: 50,
    };
    const result = computeVersionCheck(config, 25, "web");
    expect(result.status).toBe("warning");
    expect(result.message).toBe("Please update");
  });

  it("returns ok when version >= warningVersion", () => {
    const config = {
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Required",
      warningMessage: "Warning",
      webRequiredVersion: 10,
      webWarningVersion: 50,
    };
    expect(computeVersionCheck(config, 50, "web")).toEqual({status: "ok"});
    expect(computeVersionCheck(config, 100, "web")).toEqual({status: "ok"});
  });

  it("returns required when version equals requiredVersion - 1", () => {
    const config = {
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Required",
      warningMessage: "Warning",
      webRequiredVersion: 10,
      webWarningVersion: 50,
    };
    const result = computeVersionCheck(config, 9, "web");
    expect(result.status).toBe("required");
  });

  it("returns warning when version equals warningVersion - 1", () => {
    const config = {
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Required",
      warningMessage: "Warning",
      webRequiredVersion: 10,
      webWarningVersion: 50,
    };
    const result = computeVersionCheck(config, 49, "web");
    expect(result.status).toBe("warning");
  });

  it("uses default messages when config messages are empty", () => {
    const config = {
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "",
      warningMessage: "",
      webRequiredVersion: 5,
      webWarningVersion: 10,
    };
    const requiredResult = computeVersionCheck(config, 1, "web");
    expect(requiredResult.status).toBe("required");
    expect(requiredResult.message).toBe(
      "This version is no longer supported. Please update to continue."
    );

    const warningResult = computeVersionCheck(config, 7, "web");
    expect(warningResult.status).toBe("warning");
    expect(warningResult.message).toBe(
      "A new version is available. Please update for the best experience."
    );
  });
});

describe("GET /version-check", () => {
  beforeEach(async () => {
    await VersionConfig.deleteMany({});
  });

  afterEach(async () => {
    await VersionConfig.deleteMany({});
  });

  it("returns ok when no VersionConfig exists", async () => {
    const app = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    }).build();

    const res = await supertest(app)
      .get("/version-check")
      .query({platform: "web", version: 1})
      .expect(200);

    expect(res.body).toEqual({status: "ok"});
  });

  it("returns ok when version param is missing or invalid", async () => {
    const app = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    }).build();

    const res1 = await supertest(app).get("/version-check").expect(200);
    expect(res1.body).toEqual({status: "ok"});

    const res2 = await supertest(app)
      .get("/version-check")
      .query({platform: "web", version: "invalid"})
      .expect(200);
    expect(res2.body).toEqual({status: "ok"});
  });

  it("returns required when VersionConfig exists and version is below required", async () => {
    await VersionConfig.create({
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Update required",
      warningMessage: "Update recommended",
      webRequiredVersion: 10,
      webWarningVersion: 20,
    });

    const app = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    }).build();

    const res = await supertest(app)
      .get("/version-check")
      .query({platform: "web", version: 5})
      .expect(200);

    expect(res.body.status).toBe("required");
    expect(res.body.message).toBe("Update required");
  });

  it("returns warning when VersionConfig exists and version is between required and warning", async () => {
    await VersionConfig.create({
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Update required",
      warningMessage: "Update recommended",
      webRequiredVersion: 10,
      webWarningVersion: 20,
    });

    const app = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    }).build();

    const res = await supertest(app)
      .get("/version-check")
      .query({platform: "web", version: 15})
      .expect(200);

    expect(res.body.status).toBe("warning");
    expect(res.body.message).toBe("Update recommended");
  });

  it("returns ok when version meets or exceeds warning threshold", async () => {
    await VersionConfig.create({
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Update required",
      warningMessage: "Update recommended",
      webRequiredVersion: 10,
      webWarningVersion: 20,
    });

    const app = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    }).build();

    const res = await supertest(app)
      .get("/version-check")
      .query({platform: "web", version: 25})
      .expect(200);

    expect(res.body).toEqual({status: "ok"});
  });

  it("uses mobile thresholds when platform is mobile", async () => {
    await VersionConfig.create({
      mobileRequiredVersion: 100,
      mobileWarningVersion: 200,
      requiredMessage: "Mobile update required",
      warningMessage: "Mobile update recommended",
      webRequiredVersion: 0,
      webWarningVersion: 0,
    });

    const app = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    }).build();

    const requiredRes = await supertest(app)
      .get("/version-check")
      .query({platform: "mobile", version: 50})
      .expect(200);
    expect(requiredRes.body.status).toBe("required");
    expect(requiredRes.body.message).toBe("Mobile update required");

    const warningRes = await supertest(app)
      .get("/version-check")
      .query({platform: "mobile", version: 150})
      .expect(200);
    expect(warningRes.body.status).toBe("warning");
    expect(warningRes.body.message).toBe("Mobile update recommended");

    const okRes = await supertest(app)
      .get("/version-check")
      .query({platform: "mobile", version: 250})
      .expect(200);
    expect(okRes.body).toEqual({status: "ok"});
  });

  it("defaults to web platform when platform param is invalid", async () => {
    await VersionConfig.create({
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "Update required",
      warningMessage: "Update recommended",
      webRequiredVersion: 10,
      webWarningVersion: 20,
    });

    const app = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    }).build();

    const res = await supertest(app)
      .get("/version-check")
      .query({platform: "invalid", version: 5})
      .expect(200);

    expect(res.body.status).toBe("required");
    expect(res.body.message).toBe("Update required");
  });

  it("does not require authentication", async () => {
    const app = new TerrenoApp({
      skipListen: true,
      userModel: UserModel as any,
    }).build();

    await supertest(app).get("/version-check").query({platform: "web", version: 1}).expect(200);
  });
});
