import {afterAll, afterEach, beforeEach, describe, expect, it, type Mock, spyOn} from "bun:test";
import * as Sentry from "@sentry/bun";
import axios from "axios";

import {APIError} from "../errors";
import {sendToSlack} from "./slackNotifier";

describe("sendToSlack", () => {
  let mockAxiosPost: Mock<typeof axios.post>;

  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    mockAxiosPost = spyOn(axios, "post").mockResolvedValue({status: 200});
    process.env = {...ORIGINAL_ENV};
    process.env.SLACK_WEBHOOKS = undefined;
    (Sentry.captureException as Mock<typeof Sentry.captureException>).mockClear();
    (Sentry.captureMessage as Mock<typeof Sentry.captureMessage>).mockClear();
  });

  afterEach(() => {
    mockAxiosPost.mockRestore();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns early when SLACK_WEBHOOKS is missing", async () => {
    await sendToSlack("hello");
    expect(mockAxiosPost.mock.calls.length).toBe(0);
  });

  it("posts to default webhook with plain text", async () => {
    process.env.SLACK_WEBHOOKS = JSON.stringify({default: "https://slack.example/webhook"});
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToSlack("hello world");
    expect(mockAxiosPost.mock.calls.length).toBe(1);
    const callArgs = mockAxiosPost.mock.calls[0];
    expect(Array.isArray(callArgs)).toBe(true);
    const [url, payload] = callArgs;
    expect(url).toBe("https://slack.example/webhook");
    expect(payload).toEqual({text: "hello world"});
  });

  it("posts to a specific channel when provided", async () => {
    process.env.SLACK_WEBHOOKS = JSON.stringify({
      default: "https://slack.example/default",
      ops: "https://slack.example/ops",
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToSlack("ops msg", {slackChannel: "ops"});
    const callArgs = mockAxiosPost.mock.calls[0];
    expect(Array.isArray(callArgs)).toBe(true);
    const [url, payload] = callArgs;
    expect(url).toBe("https://slack.example/ops");
    expect(payload).toEqual({text: "ops msg"});
  });

  it("falls back to default when channel not found", async () => {
    process.env.SLACK_WEBHOOKS = JSON.stringify({
      default: "https://slack.example/default",
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToSlack("missing channel", {slackChannel: "unknown"});
    const callArgs = mockAxiosPost.mock.calls[0];
    expect(Array.isArray(callArgs)).toBe(true);
    const [url, payload] = callArgs;
    expect(url).toBe("https://slack.example/default");
    expect(payload).toEqual({text: "missing channel"});
  });

  it("prefixes message with [ENV] when env provided", async () => {
    process.env.SLACK_WEBHOOKS = JSON.stringify({
      default: "https://slack.example/default",
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToSlack("status ok", {env: "stg"});
    const callArgs = mockAxiosPost.mock.calls[0];
    expect(Array.isArray(callArgs)).toBe(true);
    const [, payload] = callArgs;
    expect(payload).toEqual({text: "[STG] status ok"});
  });

  it("reports to Sentry and returns early when channel has no webhook and no default", async () => {
    process.env.SLACK_WEBHOOKS = JSON.stringify({ops: "https://slack.example/ops"});

    await sendToSlack("orphan message", {slackChannel: "alerts"});
    expect(mockAxiosPost.mock.calls.length).toBe(0);
    expect(
      (Sentry.captureException as Mock<typeof Sentry.captureException>).mock.calls.length
    ).toBe(1);
    const captured = (Sentry.captureException as Mock<typeof Sentry.captureException>).mock
      .calls[0][0] as APIError;
    expect(captured).toBeInstanceOf(APIError);
    expect(captured.title).toContain("alerts");
  });

  it("posts directly using the url parameter without env lookup", async () => {
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToSlack("direct msg", {url: "https://direct.example/hook"});
    expect(mockAxiosPost.mock.calls.length).toBe(1);
    const [url, payload] = mockAxiosPost.mock.calls[0];
    expect(url).toBe("https://direct.example/hook");
    expect(payload).toEqual({text: "direct msg"});
  });

  it("captures error and throws APIError when shouldThrow=true", async () => {
    process.env.SLACK_WEBHOOKS = JSON.stringify({
      default: "https://slack.example/default",
    });
    mockAxiosPost.mockRejectedValue(new Error("slack down"));

    try {
      await sendToSlack("err", {shouldThrow: true});
      throw new Error("Expected sendToSlack to throw APIError");
    } catch (error) {
      const apiError = error as APIError;
      expect(apiError.name).toBe("APIError");
      expect(apiError.title).toMatch(/Error posting to slack/i);
    }
    expect(mockAxiosPost.mock.calls.length).toBe(1);
  });

  it("captures error and does not throw when shouldThrow=false", async () => {
    process.env.SLACK_WEBHOOKS = JSON.stringify({
      default: "https://slack.example/default",
    });
    mockAxiosPost.mockRejectedValue(new Error("slack intermittent"));

    await sendToSlack("err", {shouldThrow: false});
    expect(mockAxiosPost.mock.calls.length).toBe(1);
  });
});
