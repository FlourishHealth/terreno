import {afterEach, describe, expect, it} from "bun:test";

import {setTerrenoTestEnv} from "../env/setTerrenoTestEnv";
import {setupTestEnvironment} from "./setupEnvironment";

afterEach(() => {
  setTerrenoTestEnv();
});

describe("setupTestEnvironment", () => {
  it("throws when required auth secrets are missing", () => {
    Reflect.deleteProperty(process.env, "TOKEN_ISSUER");
    expect(() => setupTestEnvironment()).toThrow(/TOKEN_ISSUER/);
    setTerrenoTestEnv();
    Reflect.deleteProperty(process.env, "TOKEN_SECRET");
    expect(() => setupTestEnvironment()).toThrow(/TOKEN_SECRET/);
    setTerrenoTestEnv();
    Reflect.deleteProperty(process.env, "REFRESH_TOKEN_SECRET");
    expect(() => setupTestEnvironment()).toThrow(/REFRESH_TOKEN_SECRET/);
    setTerrenoTestEnv();
    Reflect.deleteProperty(process.env, "SESSION_SECRET");
    expect(() => setupTestEnvironment()).toThrow(/SESSION_SECRET/);
  });
});
