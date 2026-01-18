// biome-ignore-all lint/suspicious/noExplicitAny: tests
import {beforeEach, describe, expect, it} from "bun:test";
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

      expect(user._id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.name).toBe(name);
    });

    it("should throw error when email is missing", async () => {
      try {
        await userService.createUser("", "John Doe");
        throw new Error("Should have thrown error");
      } catch (error: any) {
        expect(error.status).toBeDefined();
        expect(error.title).toBeDefined();
        expect(error.title.toLowerCase()).toContain("required");
        expect(error.status).toBe(400);
      }
    });

    it("should throw error when name is missing", async () => {
      try {
        await userService.createUser(generateTestEmail(), "");
        throw new Error("Should have thrown error");
      } catch (error: any) {
        expect(error.status).toBeDefined();
        expect(error.title).toBeDefined();
        expect(error.title.toLowerCase()).toContain("required");
        expect(error.status).toBe(400);
      }
    });

    it("should throw error when user with email already exists", async () => {
      const email = generateTestEmail();
      await createTestUser({email});

      try {
        await userService.createUser(email, "New User");
        throw new Error("Should have thrown error");
      } catch (error: any) {
        expect(error.status).toBeDefined();
        expect(error.title).toBeDefined();
        expect(error.title.toLowerCase()).toContain("already exists");
        expect(error.status).toBe(400);
      }
    });
  });

  describe("getUserById", () => {
    it("should get user by id successfully", async () => {
      const testUser = await createTestUser();

      const user = await userService.getUserById(testUser._id.toString());

      expect(user).toBeDefined();
      if (user) {
        expect(user._id.toString()).toBe(testUser._id.toString());
        expect(user.email).toBe(testUser.email);
      }
    });

    it("should throw error when user not found", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      try {
        await userService.getUserById(fakeId);
        throw new Error("Should have thrown error");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });
});
