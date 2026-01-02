// biome-ignore-all lint/suspicious/noExplicitAny: tests
import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
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

      assert.exists(user._id);
      assert.strictEqual(user.email, email);
      assert.strictEqual(user.name, name);
      assert.exists(user.created);
      assert.exists(user.updated);
    });

    it("should require email", async () => {
      try {
        await User.create({
          name: "John Doe",
        } as any);
        assert.fail("Should have thrown validation error");
      } catch (error: any) {
        assert.include(error.message, "email");
      }
    });

    it("should require name", async () => {
      try {
        await User.create({
          email: generateTestEmail(),
        } as any);
        assert.fail("Should have thrown validation error");
      } catch (error: any) {
        assert.include(error.message, "name");
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
        assert.fail("Should have thrown duplicate key error");
      } catch (error: any) {
        assert.include(error.message, "duplicate");
      }
    });

    it("should convert email to lowercase", async () => {
      const email = "TEST@EXAMPLE.COM";
      const user = await User.create({
        email,
        name: "Test User",
      });

      assert.strictEqual(user.email, email.toLowerCase());
    });

    it("should trim email and name", async () => {
      const user = await User.create({
        email: "  test@example.com  ",
        name: "  John Doe  ",
      });

      assert.strictEqual(user.email, "test@example.com");
      assert.strictEqual(user.name, "John Doe");
    });
  });

  describe("Instance Methods", () => {
    it("should return display name with getDisplayName", async () => {
      const user = await createTestUser({name: "Jane Smith"});
      const displayName = user.getDisplayName();

      assert.strictEqual(displayName, "Jane Smith");
    });
  });

  describe("Static Methods", () => {
    it("should find user by email with findByEmail", async () => {
      const email = generateTestEmail();
      await createTestUser({email, name: "Test User"});

      const user = await User.findByEmail(email);

      assert.exists(user);
      assert.strictEqual(user?.email, email);
    });

    it("should return null when user not found by email", async () => {
      const user = await User.findByEmail("nonexistent@example.com");

      assert.isNull(user);
    });

    it("should find user by email case-insensitively", async () => {
      const email = "test@example.com";
      await createTestUser({email, name: "Test User"});

      const user = await User.findByEmail("TEST@EXAMPLE.COM");

      assert.exists(user);
      assert.strictEqual(user?.email, email);
    });
  });

  describe("findExactlyOne", () => {
    it("should find user when exists", async () => {
      const user = await createTestUser();
      const found = await User.findExactlyOne({_id: user._id});

      assert.exists(found);
      assert.strictEqual(found._id.toString(), user._id.toString());
    });

    it("should throw error when user not found", async () => {
      const fakeId = "507f1f77bcf86cd799439011";

      try {
        await User.findExactlyOne({_id: fakeId});
        assert.fail("Should have thrown error");
      } catch (error: unknown) {
        assert.exists(error);
      }
    });
  });

  describe("findOneOrNone", () => {
    it("should find user when exists", async () => {
      const user = await createTestUser();
      const found = await User.findOneOrNone({_id: user._id});

      assert.exists(found);
      assert.strictEqual(found._id.toString(), user._id.toString());
    });

    it("should return null when user not found", async () => {
      const found = await User.findOneOrNone({email: "nonexistent@example.com"});

      assert.isNull(found);
    });
  });
});
