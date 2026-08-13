import {beforeEach, describe, it} from "bun:test";
import {setupDb} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";
import mongoose from "mongoose";

import {PushToken} from "./pushToken";

describe("PushToken", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await PushToken.deleteMany({});
  });

  it("updates an existing token instead of creating a duplicate", async (): Promise<void> => {
    const firstUserId = new mongoose.Types.ObjectId();
    const secondUserId = new mongoose.Types.ObjectId();
    const firstSeenAt = DateTime.utc().minus({minutes: 1}).toJSDate();
    const secondSeenAt = DateTime.utc().toJSDate();

    await PushToken.upsert(
      {token: "ExponentPushToken[test]"},
      {
        active: true,
        lastSeenAt: firstSeenAt,
        platform: "ios",
        userId: firstUserId,
      }
    );
    const updated = await PushToken.upsert(
      {token: "ExponentPushToken[test]"},
      {
        active: true,
        lastSeenAt: secondSeenAt,
        platform: "android",
        userId: secondUserId,
      }
    );

    assert.equal(await PushToken.countDocuments(), 1);
    assert.equal(updated.platform, "android");
    assert.equal(updated.userId.toString(), secondUserId.toString());
    assert.equal(updated.lastSeenAt.toISOString(), secondSeenAt.toISOString());
  });
});
