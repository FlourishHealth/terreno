import {beforeEach, describe, expect, it} from "bun:test";
import {User} from "../models/user";
import {generateTestEmail} from "../tests/helpers";

describe("Health API", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it("should have countDocuments available for health check", async () => {
    const email = generateTestEmail();
    await User.create({email, name: "Test User"});

    const count = await User.countDocuments();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("should return zero count when no users exist", async () => {
    const count = await User.countDocuments();
    expect(count).toBe(0);
  });
});
