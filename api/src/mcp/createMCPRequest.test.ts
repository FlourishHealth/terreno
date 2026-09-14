import {describe, expect, it} from "bun:test";

import {createMCPRequest} from "./createMCPRequest";
import type {MCPRequest} from "./types";

const asMCPRequest = (req: unknown): MCPRequest => {
  return req as unknown as MCPRequest;
};

describe("createMCPRequest", () => {
  it("returns a stub Express-shaped request, not a real HTTP request", () => {
    const user = {_id: "user-1"} as MCPRequest["user"];
    const request = asMCPRequest(
      createMCPRequest({
        body: {title: "Hooked"},
        user,
      })
    );

    expect(request.isMCPRequest).toBe(true);
    expect(request.method).toBe("MCP");
    expect(request.body).toEqual({title: "Hooked"});
    expect(request.headers).toEqual({});
    expect(request.query).toEqual({});
    expect(request.params).toEqual({});
    expect(request.user).toBe(user);
    expect(Object.keys(request).sort()).toEqual([
      "body",
      "headers",
      "isMCPRequest",
      "method",
      "params",
      "query",
      "user",
    ]);
  });

  it("defaults missing body to {} and omits user", () => {
    const request = asMCPRequest(createMCPRequest({}));

    expect(request.body).toEqual({});
    expect(request.user).toBeUndefined();
    expect(request.headers).toEqual({});
    expect(request.query).toEqual({});
    expect(request.params).toEqual({});
  });
});
