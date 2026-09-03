import {beforeEach, describe, it} from "bun:test";
import {createHash} from "node:crypto";
import {assert} from "chai";
import {DateTime} from "luxon";
import mongoose from "mongoose";

import {McpServiceToken} from "./mcpServiceToken";

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

describe("McpServiceToken", () => {
  beforeEach(async () => {
    await McpServiceToken.deleteMany({});
  });

  it("issues an mcp_ token and stores only its SHA-256 hash", async () => {
    const userId = new mongoose.Types.ObjectId();
    const issued = await McpServiceToken.issueFor({_id: userId}, {name: "Perplexity"});

    assert.match(issued.token, /^mcp_[0-9a-f]{64}$/);
    assert.equal(issued.mcpServiceToken.name, "Perplexity");
    assert.equal(issued.mcpServiceToken.tokenHash, hashToken(issued.token));
    assert.equal(issued.mcpServiceToken.tokenPrefix, issued.token.slice(4, 12));
    assert.notInclude(JSON.stringify(issued.mcpServiceToken.toJSON()), issued.token);
  });

  it("verifies an active token but not a revoked or expired token", async () => {
    const userId = new mongoose.Types.ObjectId();
    const active = await McpServiceToken.issueFor({_id: userId}, {name: "Active"});
    const revoked = await McpServiceToken.issueFor({_id: userId}, {name: "Revoked"});
    const expired = await McpServiceToken.issueFor(
      {_id: userId},
      {expiresAt: DateTime.now().minus({minute: 1}).toJSDate(), name: "Expired"}
    );

    await McpServiceToken.revokeForUser({_id: userId}, revoked.mcpServiceToken._id);

    assert.equal(
      (await McpServiceToken.verify(active.token))?._id.toString(),
      active.mcpServiceToken._id.toString()
    );
    assert.isNull(await McpServiceToken.verify(revoked.token));
    assert.isNull(await McpServiceToken.verify(expired.token));
  });

  it("counts only active tokens for a user", async () => {
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const revoked = await McpServiceToken.issueFor({_id: userId}, {name: "Revoked"});
    await McpServiceToken.issueFor({_id: userId}, {name: "Active"});
    await McpServiceToken.issueFor(
      {_id: userId},
      {expiresAt: DateTime.now().minus({minute: 1}).toJSDate(), name: "Expired"}
    );
    await McpServiceToken.issueFor({_id: otherUserId}, {name: "Other"});
    await McpServiceToken.revokeForUser({_id: userId}, revoked.mcpServiceToken._id);

    assert.equal(await McpServiceToken.countActiveForUser(userId), 1);
  });
});
