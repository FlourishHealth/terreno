import {afterEach, describe, it} from "bun:test";
import {assert} from "chai";

import {AdminAPIError, adminRequest, DEFAULT_ADMIN_REQUEST_TIMEOUT_MS} from "./adminRequest";

describe("adminRequest", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("forwards credentials and JSON-stringifies object bodies", async () => {
    let captured: RequestInit | undefined;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = init;
      return new Response(JSON.stringify({ok: true}), {
        headers: {"Content-Type": "application/json"},
        status: 200,
      });
    }) as typeof fetch;

    const result = await adminRequest({
      body: {title: "Hi"},
      credentials: "same-origin",
      method: "POST",
      url: "/admin/todos",
    });
    assert.deepEqual(result, {ok: true});
    assert.strictEqual(captured?.credentials, "same-origin");
    assert.strictEqual(captured?.method, "POST");
    assert.strictEqual(captured?.body, JSON.stringify({title: "Hi"}));
    const headers = new Headers(captured?.headers);
    assert.strictEqual(headers.get("Content-Type"), "application/json");
  });

  it("does not JSON-stringify FormData and does not set Content-Type", async () => {
    let captured: RequestInit | undefined;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = init;
      return new Response(null, {status: 204});
    }) as typeof fetch;

    const formData = new FormData();
    formData.append("file", "bytes");
    await adminRequest({body: formData, method: "POST", url: "/documents"});
    assert.instanceOf(captured?.body, FormData);
    const headers = new Headers(captured?.headers);
    assert.isNull(headers.get("Content-Type"));
  });

  it("maps 4xx JSON failures to AdminAPIError", async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({detail: "q", title: "Invalid filter"}), {
        headers: {"Content-Type": "application/json"},
        status: 400,
      });
    }) as typeof fetch;

    try {
      await adminRequest({method: "GET", url: "/admin/todos"});
      assert.fail("expected AdminAPIError");
    } catch (error) {
      assert.instanceOf(error, AdminAPIError);
      const apiError = error as AdminAPIError;
      assert.strictEqual(apiError.status, 400);
      assert.strictEqual(apiError.data.title, "Invalid filter");
      assert.strictEqual(apiError.data.detail, "q");
    }
  });

  it("maps 5xx failures without JSON to AdminAPIError", async () => {
    globalThis.fetch = (async () => {
      return new Response("nope", {status: 503, statusText: "Service Unavailable"});
    }) as typeof fetch;

    try {
      await adminRequest({method: "GET", url: "/admin/config"});
      assert.fail("expected AdminAPIError");
    } catch (error) {
      assert.instanceOf(error, AdminAPIError);
      const apiError = error as AdminAPIError;
      assert.strictEqual(apiError.status, 503);
      assert.strictEqual(apiError.data.title, "Service Unavailable");
    }
  });

  it("aborts when the timeout elapses", async () => {
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      return await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("Aborted"), {name: "AbortError"}));
        });
      });
    }) as typeof fetch;

    try {
      await adminRequest({method: "GET", timeoutMs: 5, url: "/admin/slow"});
      assert.fail("expected timeout AdminAPIError");
    } catch (error) {
      assert.instanceOf(error, AdminAPIError);
      const apiError = error as AdminAPIError;
      assert.strictEqual(apiError.status, 0);
      assert.include(apiError.data.title.toLowerCase(), "timed out");
    }
  });

  it("uses the default timeout constant", () => {
    assert.strictEqual(DEFAULT_ADMIN_REQUEST_TIMEOUT_MS, 30_000);
  });
});
