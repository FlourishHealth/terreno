import {describe, expect, it} from "bun:test";

import {registerExpoPushToken} from "./registerExpoPushToken";

describe("registerExpoPushToken", () => {
  it("skips web platforms without fetching a token", async () => {
    let fetched = false;
    const result = await registerExpoPushToken({
      getToken: async () => {
        fetched = true;
        return {data: "ExponentPushToken[x]"};
      },
      platform: "web",
      postToken: async () => {
        throw new Error("should not post");
      },
    });
    expect(result).toBe("skipped");
    expect(fetched).toBe(false);
  });

  it("skips when the Expo token is empty", async () => {
    const posts: unknown[] = [];
    const result = await registerExpoPushToken({
      getToken: async () => ({data: ""}),
      platform: "ios",
      postToken: async (body) => {
        posts.push(body);
      },
    });
    expect(result).toBe("skipped");
    expect(posts).toEqual([]);
  });

  it("posts an iOS token after login", async () => {
    const posts: Array<{platform: string; token: string}> = [];
    const result = await registerExpoPushToken({
      getToken: async () => ({data: "ExponentPushToken[abc]"}),
      platform: "ios",
      postToken: async (body) => {
        posts.push(body);
      },
    });
    expect(result).toBe("registered");
    expect(posts).toEqual([{platform: "ios", token: "ExponentPushToken[abc]"}]);
  });
});
