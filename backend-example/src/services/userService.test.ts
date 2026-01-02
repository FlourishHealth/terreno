// biome-ignore-all lint/suspicious/noExplicitAny: tests
import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import {User} from "../models/user";
import {createTestUser, generateTestEmail} from "../test/helpers";
import {userService} from "./userService";

describe("User Service", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("createUser", () => {
    it("should create a new user successfully", async () => {
      const email = generateTestEmail();
      const name = "John Doe";

      const user = await userService.createUser(email, name);

      assert.exists(user._id);
      assert.strictEqual(user.email, email);
      assert.strictEqual(user.name, name);
    });

    it("should throw error when email is missing", async () => {
      try {
        await userService.createUser("", "John Doe");
        assert.fail("Should have thrown error");
      } catch (error: any) {
        assert.exists(error.status);
        assert.exists(error.title);
        assert.include(error.title.toLowerCase(), "required");
        assert.strictEqual(error.status, 400);
      }
    });

    it("should throw error when name is missing", async () => {
      try {
        await userService.createUser(generateTestEmail(), "");
        assert.fail("Should have thrown error");
      } catch (error: any) {
        assert.exists(error.status);
        assert.exists(error.title);
        assert.include(error.title.toLowerCase(), "required");
        assert.strictEqual(error.status, 400);
      }
    });

    it("should throw error when user with email already exists", async () => {
      const email = generateTestEmail();
      await createTestUser({email});

      try {
        await userService.createUser(email, "New User");
        assert.fail("Should have thrown error");
      } catch (error: any) {
        assert.exists(error.status);
        assert.exists(error.title);
        assert.include(error.title.toLowerCase(), "already exists");
        assert.strictEqual(error.status, 400);
      }
    });
  });

  describe("getUserById", () => {
    it("should get user by id successfully", async () => {
      const testUser = await createTestUser();

      const user = await userService.getUserById(testUser._id.toString());

      assert.exists(user);
      assert.strictEqual(user._id.toString(), testUser._id.toString());
      assert.strictEqual(user.email, testUser.email);
    });

    it("should throw error when user not found", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      try {
        await userService.getUserById(fakeId);
        assert.fail("Should have thrown error");
      } catch (error: unknown) {
        assert.exists(error);
      }
    });
  });
});
