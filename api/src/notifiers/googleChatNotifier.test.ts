import {afterAll, afterEach, beforeEach, describe, expect, it, type Mock, spyOn} from "bun:test";
import * as Sentry from "@sentry/node";
import axios from "axios";

import {sendToGoogleChat} from "./googleChatNotifier";

describe("sendToGoogleChat", () => {
  let mockAxiosPost: Mock<typeof axios.post>;

  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    mockAxiosPost = spyOn(axios, "post").mockResolvedValue({status: 200} as any);
    process.env = {...ORIGINAL_ENV};
    process.env.GOOGLE_CHAT_WEBHOOKS = undefined;
    (Sentry.captureException as Mock<typeof Sentry.captureException>).mockClear();
    (Sentry.captureMessage as Mock<typeof Sentry.captureMessage>).mockClear();
  });

  afterEach(() => {
    mockAxiosPost.mockRestore();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns early when GOOGLE_CHAT_WEBHOOKS is missing", async () => {
    await sendToGoogleChat("hello");
    expect(mockAxiosPost.mock.calls.length).toBe(0);
  });

  it("posts to default webhook with plain text", async () => {
    process.env.GOOGLE_CHAT_WEBHOOKS = JSON.stringify({
      default: "https://chat.example/webhook",
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToGoogleChat("hello world");
    const callArgs = mockAxiosPost.mock.calls[0];
    expect(Array.isArray(callArgs)).toBe(true);
    const [url, payload] = callArgs;
    expect(url).toBe("https://chat.example/webhook");
    expect(payload).toEqual({text: "hello world"});
  });

  it("posts to a specific channel when provided", async () => {
    process.env.GOOGLE_CHAT_WEBHOOKS = JSON.stringify({
      default: "https://chat.example/default",
      ops: "https://chat.example/ops",
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToGoogleChat("ops msg", {channel: "ops"});
    const callArgs = mockAxiosPost.mock.calls[0];
    expect(Array.isArray(callArgs)).toBe(true);
    const [url, payload] = callArgs;
    expect(url).toBe("https://chat.example/ops");
    expect(payload).toEqual({text: "ops msg"});
  });

  it("falls back to default when channel not found", async () => {
    process.env.GOOGLE_CHAT_WEBHOOKS = JSON.stringify({
      default: "https://chat.example/default",
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToGoogleChat("missing channel", {channel: "unknown"});
    const callArgs = mockAxiosPost.mock.calls[0];
    expect(Array.isArray(callArgs)).toBe(true);
    const [url, payload] = callArgs;
    expect(url).toBe("https://chat.example/default");
    expect(payload).toEqual({text: "missing channel"});
  });

  it("prefixes message with [ENV] when env provided", async () => {
    process.env.GOOGLE_CHAT_WEBHOOKS = JSON.stringify({
      default: "https://chat.example/default",
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToGoogleChat("status ok", {env: "prod"});
    const callArgs = mockAxiosPost.mock.calls[0];
    expect(Array.isArray(callArgs)).toBe(true);
    const [, payload] = callArgs;
    expect(payload).toEqual({text: "[PROD] status ok"});
  });

  it("captures error and throws APIError when shouldThrow=true", async () => {
    process.env.GOOGLE_CHAT_WEBHOOKS = JSON.stringify({
      default: "https://chat.example/default",
    });
    mockAxiosPost.mockRejectedValue(new Error("chat down"));

    try {
      await sendToGoogleChat("err", {shouldThrow: true});
      throw new Error("Expected sendToGoogleChat to throw APIError");
    } catch (error) {
      expect((error as any).name).toBe("APIError");
      expect((error as any).title).toMatch(/Error posting to Google Chat/i);
    }
    expect(mockAxiosPost.mock.calls.length).toBe(1);
  });

  it("captures error and does not throw when shouldThrow=false", async () => {
    process.env.GOOGLE_CHAT_WEBHOOKS = JSON.stringify({
      default: "https://chat.example/default",
    });
    mockAxiosPost.mockRejectedValue(new Error("chat intermittent"));

    await sendToGoogleChat("err", {shouldThrow: false});
    expect(mockAxiosPost.mock.calls.length).toBe(1);
  });
});
