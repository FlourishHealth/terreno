import {describe, expect, it} from "bun:test";
import {setTerrenoTestEnv} from "../env/setTerrenoTestEnv";
import {buildDatabaseUri, splitMongoUri} from "./connection";

describe("mongo connection helpers", () => {
  it("splitMongoUri separates base URI and query options", () => {
    const result = splitMongoUri("mongodb://127.0.0.1/mydb?retryWrites=true");
    expect(result.baseUri).toBe("mongodb://127.0.0.1");
    expect(result.uriOptions).toBe("?retryWrites=true");
  });

  it("buildDatabaseUri appends database name and preserves query params", () => {
    const uri = buildDatabaseUri({
      databaseName: "terrenoTest_base",
      uri: "mongodb://127.0.0.1/?retryWrites=true",
    });
    expect(uri).toBe("mongodb://127.0.0.1/terrenoTest_base?retryWrites=true");
  });
});

describe("setTerrenoTestEnv", () => {
  it("sets canonical auth env keys", () => {
    setTerrenoTestEnv({tokenIssuer: "unit.test"});
    expect(process.env.TOKEN_SECRET).toBe("secret");
    expect(process.env.TOKEN_ISSUER).toBe("unit.test");
    expect(process.env.SESSION_SECRET).toBe("sessionSecret");
    expect(process.env.REFRESH_TOKEN_SECRET).toBe("refreshTokenSecret");
  });
});
