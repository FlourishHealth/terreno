import {beforeEach, describe, it} from "bun:test";
import {createHash} from "node:crypto";
import {assert} from "chai";
import {DateTime} from "luxon";
import mongoose from "mongoose";

import {AUTH_TOKEN_TTL, AuthToken} from "./authTokens";

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

describe("AuthToken", () => {
  beforeEach(async () => {
    await AuthToken.deleteMany({});
  });

  it("issues a hashed single-use token with type-specific TTL and never stores plaintext", async () => {
    const userId = new mongoose.Types.ObjectId();
    const issued = await AuthToken.issueFor({_id: userId}, "passwordReset");

    assert.match(issued.token, /^[0-9a-f]{64}$/);
    assert.equal(issued.authToken.tokenHash, hashToken(issued.token));
    assert.notInclude(JSON.stringify(issued.authToken.toJSON()), issued.token);
    assert.isUndefined(issued.authToken.consumedAt);

    const ttlMs = issued.authToken.expiresAt.getTime() - issued.authToken.created.getTime();
    const expectedMs = AUTH_TOKEN_TTL.passwordReset.as("milliseconds");
    assert.approximately(ttlMs, expectedMs, 5_000);

    const verifyIssued = await AuthToken.issueFor({_id: userId}, "emailVerification");
    const verifyTtlMs =
      verifyIssued.authToken.expiresAt.getTime() - verifyIssued.authToken.created.getTime();
    assert.approximately(verifyTtlMs, AUTH_TOKEN_TTL.emailVerification.as("milliseconds"), 5_000);
  });

  it("consumes a token exactly once under parallel callers", async () => {
    const userId = new mongoose.Types.ObjectId();
    const {token} = await AuthToken.issueFor({_id: userId}, "passwordReset");

    const results = await Promise.all(
      Array.from({length: 20}, () => AuthToken.consume(token, "passwordReset"))
    );
    const winners = results.filter((doc) => doc !== null);

    assert.equal(winners.length, 1);
    assert.equal(String(winners[0]?.userId), String(userId));
    assert.isDefined(winners[0]?.consumedAt);

    const secondPass = await AuthToken.consume(token, "passwordReset");
    assert.isNull(secondPass);
  });

  it("does not consume an expired token", async () => {
    const userId = new mongoose.Types.ObjectId();
    const {token, authToken} = await AuthToken.issueFor({_id: userId}, "passwordReset");
    authToken.expiresAt = DateTime.fromMillis(0).toJSDate();
    await authToken.save();

    const consumed = await AuthToken.consume(token, "passwordReset");
    assert.isNull(consumed);
  });

  it("does not consume a token of a different type", async () => {
    const userId = new mongoose.Types.ObjectId();
    const {token} = await AuthToken.issueFor({_id: userId}, "passwordReset");

    const consumed = await AuthToken.consume(token, "emailVerification");
    assert.isNull(consumed);
  });

  it("invalidates earlier unused tokens of the same type when issuing a new one", async () => {
    const userId = new mongoose.Types.ObjectId();
    const firstReset = await AuthToken.issueFor({_id: userId}, "passwordReset");
    const firstVerify = await AuthToken.issueFor({_id: userId}, "emailVerification");
    const secondReset = await AuthToken.issueFor({_id: userId}, "passwordReset");

    assert.isNull(await AuthToken.consume(firstReset.token, "passwordReset"));
    const stillValidVerify = await AuthToken.consume(firstVerify.token, "emailVerification");
    assert.isNotNull(stillValidVerify);
    const consumedSecond = await AuthToken.consume(secondReset.token, "passwordReset");
    assert.isNotNull(consumedSecond);
  });

  it("invalidates unused tokens of a type without issuing a replacement", async () => {
    const userId = new mongoose.Types.ObjectId();
    const issued = await AuthToken.issueFor({_id: userId}, "emailVerification");
    const resetIssued = await AuthToken.issueFor({_id: userId}, "passwordReset");

    await AuthToken.invalidateUnusedFor({_id: userId}, "emailVerification");

    assert.isNull(await AuthToken.consume(issued.token, "emailVerification"));
    const stillValidReset = await AuthToken.consume(resetIssued.token, "passwordReset");
    assert.isNotNull(stillValidReset);
  });
});
