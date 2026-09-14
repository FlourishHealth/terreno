import {describe, expect, it} from "bun:test";
import {
  DEFAULT_PLAYGROUND_API_KEY_HINT,
  PLAYGROUND_BACKEND_UNAVAILABLE_MESSAGE,
  PLAYGROUND_MISSING_API_KEY_ERROR_TITLE,
  resolvePlaygroundBlockedMessage,
  resolvePlaygroundRunError,
} from "./playgroundAccess";

describe("resolvePlaygroundBlockedMessage", () => {
  it("returns undefined while the host is still loading a saved key", () => {
    expect(
      resolvePlaygroundBlockedMessage({
        apiKeyLoading: true,
        playgroundAiSource: "request-key",
      })
    ).toBeUndefined();
  });

  it("returns a hint when the backend expects a request key and none is available", () => {
    expect(
      resolvePlaygroundBlockedMessage({
        playgroundAiSource: "request-key",
      })
    ).toBe(DEFAULT_PLAYGROUND_API_KEY_HINT);

    expect(
      resolvePlaygroundBlockedMessage({
        apiKeyHint: "Save a key on Profile.",
        playgroundAiSource: "request-key",
      })
    ).toBe("Save a key on Profile.");
  });

  it("does not block when a trimmed key is present or the server provides AI", () => {
    expect(
      resolvePlaygroundBlockedMessage({
        apiKey: "  saved-key  ",
        playgroundAiSource: "request-key",
      })
    ).toBeUndefined();

    expect(
      resolvePlaygroundBlockedMessage({
        playgroundAiSource: "server",
      })
    ).toBeUndefined();
  });

  it("reports backend misconfiguration only when playground AI is unavailable", () => {
    expect(
      resolvePlaygroundBlockedMessage({
        playgroundAiSource: "unavailable",
      })
    ).toBe(PLAYGROUND_BACKEND_UNAVAILABLE_MESSAGE);
  });
});

describe("resolvePlaygroundRunError", () => {
  it("maps the missing-key 503 title to the host hint for request-key backends", () => {
    expect(
      resolvePlaygroundRunError({
        error: {data: {title: PLAYGROUND_MISSING_API_KEY_ERROR_TITLE}},
        playgroundAiSource: "request-key",
      })
    ).toBe(DEFAULT_PLAYGROUND_API_KEY_HINT);

    expect(
      resolvePlaygroundRunError({
        apiKeyHint: "Save a key on Profile.",
        error: {data: {title: PLAYGROUND_MISSING_API_KEY_ERROR_TITLE}},
        playgroundAiSource: "request-key",
      })
    ).toBe("Save a key on Profile.");
  });

  it("keeps the backend title when a key was supplied or the server owns AI", () => {
    expect(
      resolvePlaygroundRunError({
        apiKey: "saved-key",
        error: {data: {title: PLAYGROUND_MISSING_API_KEY_ERROR_TITLE}},
        playgroundAiSource: "request-key",
      })
    ).toBe(PLAYGROUND_MISSING_API_KEY_ERROR_TITLE);

    expect(
      resolvePlaygroundRunError({
        error: {data: {title: PLAYGROUND_MISSING_API_KEY_ERROR_TITLE}},
        playgroundAiSource: "server",
      })
    ).toBe(PLAYGROUND_MISSING_API_KEY_ERROR_TITLE);
  });

  it("falls back to a generic message when the error has no title", () => {
    expect(
      resolvePlaygroundRunError({
        error: new Error("network"),
        playgroundAiSource: "request-key",
      })
    ).toBe("Playground run failed. Try again or check your AI configuration.");
  });
});
