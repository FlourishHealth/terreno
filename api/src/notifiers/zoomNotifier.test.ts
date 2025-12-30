import {afterAll, afterEach, beforeEach, describe, it, type Mock, spyOn} from "bun:test";
import * as Sentry from "@sentry/node";
import axios from "axios";
import chai from "chai";

const assert: Chai.AssertStatic = chai.assert;

import {sendToZoom} from "./zoomNotifier";

describe("sendToZoom", () => {
  let mockAxiosPost: Mock<typeof axios.post>;

  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    mockAxiosPost = spyOn(axios, "post").mockResolvedValue({status: 200} as any);
    process.env = {...ORIGINAL_ENV};
    process.env.ZOOM_CHAT_WEBHOOKS = undefined;
    (Sentry.captureException as Mock<typeof Sentry.captureException>).mockClear();
    (Sentry.captureMessage as Mock<typeof Sentry.captureMessage>).mockClear();
  });

  afterEach(() => {
    mockAxiosPost.mockRestore();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns early when ZOOM_CHAT_WEBHOOKS is missing", async () => {
    await sendToZoom({body: "world", header: "hello"}, {channel: "default"});
    assert.equal(mockAxiosPost.mock.calls.length, 0);
  });

  it("posts to default webhook with rich message format and authorization header", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        channel: "https://zoom.example/webhook",
        verificationToken: "test-token-123",
      },
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToZoom({body: "world", header: "hello"}, {channel: "default"});
    assert.equal(mockAxiosPost.mock.calls.length, 1);
    const callArgs = mockAxiosPost.mock.calls[0];
    assert.isArray(callArgs);
    const [url, payload, options] = callArgs;
    assert.equal(url, "https://zoom.example/webhook?format=full");
    assert.deepEqual(payload, {
      content: {
        body: [{text: "world", type: "message"}],
        head: {text: "hello"},
      },
    });
    assert.deepEqual(options?.headers, {
      Authorization: "test-token-123",
      "Content-Type": "application/json",
    });
  });

  it("posts to a specific channel when provided", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        channel: "https://zoom.example/default",
        verificationToken: "default-token",
      },
      ops: {
        channel: "https://zoom.example/ops",
        verificationToken: "ops-token",
      },
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToZoom({body: "ops msg", header: "ops msg"}, {channel: "ops"});
    const callArgs = mockAxiosPost.mock.calls[0];
    assert.isArray(callArgs);
    const [url, payload, options] = callArgs;
    assert.equal(url, "https://zoom.example/ops?format=full");
    assert.deepEqual(payload, {
      content: {
        body: [{text: "ops msg", type: "message"}],
        head: {text: "ops msg"},
      },
    });
    assert.equal(options?.headers?.Authorization, "ops-token");
  });

  it("falls back to default when channel not found", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        channel: "https://zoom.example/default",
        verificationToken: "default-token",
      },
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToZoom({body: "missing channel", header: "missing channel"}, {channel: "unknown"});
    const callArgs = mockAxiosPost.mock.calls[0];
    assert.isArray(callArgs);
    const [url, payload] = callArgs;
    assert.equal(url, "https://zoom.example/default?format=full");
    assert.deepEqual(payload, {
      content: {
        body: [{text: "missing channel", type: "message"}],
        head: {text: "missing channel"},
      },
    });
  });

  it("returns early when webhook url is missing for channel", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        verificationToken: "default-token",
      },
    });

    await sendToZoom({body: "no url", header: "no url"}, {channel: "default"});
    assert.equal(mockAxiosPost.mock.calls.length, 0);
  });

  it("returns early when verification token is missing for channel", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        channel: "https://zoom.example/default",
      },
    });

    await sendToZoom({body: "no token", header: "no token"}, {channel: "default"});
    assert.equal(mockAxiosPost.mock.calls.length, 0);
  });

  it("prefixes header with [ENV] when env provided", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        channel: "https://zoom.example/default",
        verificationToken: "token",
      },
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToZoom({body: "status ok", header: "status ok"}, {channel: "default", env: "stg"});
    const callArgs = mockAxiosPost.mock.calls[0];
    assert.isArray(callArgs);
    const [, payload] = callArgs;
    assert.deepEqual(payload, {
      content: {
        body: [{text: "status ok", type: "message"}],
        head: {text: "[STG] status ok"},
      },
    });
  });

  it("includes subheader when provided", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        channel: "https://zoom.example/default",
        verificationToken: "token",
      },
    });
    mockAxiosPost.mockResolvedValue({status: 200});

    await sendToZoom(
      {body: "Body text", header: "Main Header", subheader: "Subheader text"},
      {channel: "default"}
    );
    const callArgs = mockAxiosPost.mock.calls[0];
    assert.isArray(callArgs);
    const [, payload] = callArgs;
    assert.deepEqual(payload, {
      content: {
        body: [{text: "Body text", type: "message"}],
        head: {sub_head: {text: "Subheader text"}, text: "Main Header"},
      },
    });
  });

  it("captures error and throws APIError when shouldThrow=true", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        channel: "https://zoom.example/default",
        verificationToken: "token",
      },
    });
    mockAxiosPost.mockRejectedValue(new Error("zoom down"));

    try {
      await sendToZoom({body: "err", header: "err"}, {channel: "default", shouldThrow: true});
      assert.fail("Expected sendToZoom to throw APIError");
    } catch (error) {
      assert.equal((error as any).name, "APIError");
      assert.match((error as any).title, /Error posting to Zoom/i);
    }
    assert.equal(mockAxiosPost.mock.calls.length, 1);
  });

  it("captures error and does not throw when shouldThrow=false", async () => {
    process.env.ZOOM_CHAT_WEBHOOKS = JSON.stringify({
      default: {
        channel: "https://zoom.example/default",
        verificationToken: "token",
      },
    });
    mockAxiosPost.mockRejectedValue(new Error("zoom intermittent"));

    await sendToZoom({body: "err", header: "err"}, {channel: "default", shouldThrow: false});
    assert.equal(mockAxiosPost.mock.calls.length, 1);
  });
});
