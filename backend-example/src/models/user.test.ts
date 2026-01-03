// biome-ignore-all lint/suspicious/noExplicitAny: tests
import {beforeEach, describe, expect, it} from "bun:test";
import {createTestUser, generateTestEmail} from "../test/helpers";
import {User} from "./user";

describe("User Model", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("Schema Validation", () => {
    it("should create a user with valid data", async () => {
      const email = generateTestEmail();
      const name = "John Doe";

      const user = await User.create({
        email,
        name,
      });

      expect(user._id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.name).toBe(name);
      expect(user.created).toBeDefined();
      expect(user.updated).toBeDefined();
    });

    it("should require email", async () => {
      try {
        await User.create({
          name: "John Doe",
        } as any);
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("email");
      }
    });

    it("should require name", async () => {
      try {
        await User.create({
          email: generateTestEmail(),
        } as any);
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("name");
      }
    });

    it("should enforce unique email", async () => {
      const email = generateTestEmail();

      await User.create({
        email,
        name: "User One",
      });

      try {
        await User.create({
          email,
          name: "User Two",
        });
        throw new Error("Should have thrown duplicate key error");
      } catch (error: any) {
        expect(error.message).toContain("duplicate");
      }
    });

    it("should convert email to lowercase", async () => {
      const email = "TEST@EXAMPLE.COM";
      const user = await User.create({
        email,
        name: "Test User",
      });

      expect(user.email).toBe(email.toLowerCase());
    });

    it("should trim email and name", async () => {
      const user = await User.create({
        email: "  test@example.com  ",
        name: "  John Doe  ",
      });

      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("John Doe");
    });
  });

  describe("Instance Methods", () => {
    it("should return display name with getDisplayName", async () => {
      const user = await createTestUser({name: "Jane Smith"});
      const displayName = user.getDisplayName();

      expect(displayName).toBe("Jane Smith");
    });
  });

  describe("Static Methods", () => {
    it("should find user by email with findByEmail", async () => {
      const email = generateTestEmail();
      await createTestUser({email, name: "Test User"});

      const user = await User.findByEmail(email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it("should return null when user not found by email", async () => {
      const user = await User.findByEmail("nonexistent@example.com");

      expect(user).toBeNull();
    });

    it("should find user by email case-insensitively", async () => {
      const email = "test@example.com";
      await createTestUser({email, name: "Test User"});

      const user = await User.findByEmail("TEST@EXAMPLE.COM");

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });
  });

  describe("findExactlyOne", () => {
    it("should find user when exists", async () => {
      const user = await createTestUser();
      const found = await User.findExactlyOne({_id: user._id});

      expect(found).toBeDefined();
      assert.strictEqual(found._id.toString(), user._id.toString());
    });

    it("should throw error when user not found", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      try {
        await User.findExactlyOne({_id: fakeId});
        throw new Error("Should have thrown error");
      } catch (error: unknown) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("findOneOrNone", () => {
    it("should find user when exists", async () => {
      const user = await createTestUser();
      const found = await User.findOneOrNone({_id: user._id});

      expect(found).toBeDefined();
      assert.strictEqual(found._id.toString(), user._id.toString());
    });

    it("should return null when user not found", async () => {
      const found = await User.findOneOrNone({email: "nonexistent@example.com"});

      expect(found).toBeNull();
    });
  });
});
