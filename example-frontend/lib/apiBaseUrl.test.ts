import {describe, it} from "bun:test";
import {assert} from "chai";
import {resolveApiBaseUrl} from "./apiBaseUrl";

describe("resolveApiBaseUrl", () => {
  it("prefers the deployment BASE_URL over the local apiBaseUrl fallback", () => {
    const result = resolveApiBaseUrl({
      expoExtra: {
        apiBaseUrl: "http://localhost:4000",
        BASE_URL: "https://pr-869---terreno-backend-example.run.app",
      },
    });

    assert.equal(result, "https://pr-869---terreno-backend-example.run.app");
  });

  it("prefers an explicit Expo public environment URL", () => {
    const result = resolveApiBaseUrl({
      envApiUrl: "https://api.example.com",
      expoExtra: {
        BASE_URL: "https://fallback.example.com",
      },
    });

    assert.equal(result, "https://api.example.com");
  });

  it("falls back to the local backend in development", () => {
    assert.equal(resolveApiBaseUrl({}), "http://localhost:4000");
  });
});
