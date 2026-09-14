import {describe, it, mock} from "bun:test";
import {assert} from "chai";

const setStringAsync = mock(async (_value: string): Promise<void> => undefined);

mock.module("expo-clipboard", () => ({
  setStringAsync,
}));

const {buildMcpClientSnippet, copyMcpText, formatMcpTimestamp, issuedTokenFromCreateResult} =
  await import("./mcpSettingsHelpers");

describe("mcpSettingsHelpers", () => {
  it("formats valid ISO timestamps and dashes missing or invalid values", () => {
    assert.equal(formatMcpTimestamp(null), "—");
    assert.equal(formatMcpTimestamp(""), "—");
    assert.equal(formatMcpTimestamp("not-a-date"), "—");
    assert.match(formatMcpTimestamp("2026-09-03T12:00:00.000Z"), /\d/);
  });

  it("builds a client JSON snippet with a Bearer header", () => {
    const snippet = buildMcpClientSnippet("https://api.example.com/mcp", "mcp_secret");
    const parsed = JSON.parse(snippet) as {
      mcpServers: {"my-app": {headers: {Authorization: string}; url: string}};
    };
    assert.equal(parsed.mcpServers["my-app"].url, "https://api.example.com/mcp");
    assert.equal(parsed.mcpServers["my-app"].headers.Authorization, "Bearer mcp_secret");
  });

  it("reads the unwrapped create payload or nested data", () => {
    assert.deepEqual(issuedTokenFromCreateResult({mcpUrl: "https://x/mcp", token: "mcp_a"}), {
      mcpUrl: "https://x/mcp",
      token: "mcp_a",
    });
    assert.deepEqual(
      issuedTokenFromCreateResult({data: {mcpUrl: "https://y/mcp", token: "mcp_b"}}),
      {mcpUrl: "https://y/mcp", token: "mcp_b"}
    );
    assert.isNull(issuedTokenFromCreateResult({}));
  });

  it("copies via expo-clipboard", async () => {
    await copyMcpText("mcp_secret");
    assert.equal(setStringAsync.mock.calls[0]?.[0], "mcp_secret");
  });
});
