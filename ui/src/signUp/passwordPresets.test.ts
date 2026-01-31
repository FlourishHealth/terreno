import {describe, expect, it} from "bun:test";

import {defaultPasswordRequirements, simplePasswordRequirements} from "./passwordPresets";

describe("passwordPresets", () => {
  describe("defaultPasswordRequirements", () => {
    it("should have 5 requirements", () => {
      expect(defaultPasswordRequirements).toHaveLength(5);
    });

    describe("minLength requirement", () => {
      const minLength = defaultPasswordRequirements.find((r) => r.id === "minLength")!;

      it("should exist", () => {
        expect(minLength).toBeDefined();
        expect(minLength.label).toBe("At least 8 characters");
      });

      it("should pass for 8+ characters", () => {
        expect(minLength.validate("12345678")).toBe(true);
        expect(minLength.validate("abcdefghij")).toBe(true);
      });

      it("should fail for less than 8 characters", () => {
        expect(minLength.validate("1234567")).toBe(false);
        expect(minLength.validate("")).toBe(false);
        expect(minLength.validate("abc")).toBe(false);
      });
    });

    describe("uppercase requirement", () => {
      const uppercase = defaultPasswordRequirements.find((r) => r.id === "uppercase")!;

      it("should exist", () => {
        expect(uppercase).toBeDefined();
        expect(uppercase.label).toBe("At least one uppercase letter");
      });

      it("should pass for passwords with uppercase letters", () => {
        expect(uppercase.validate("Password")).toBe(true);
        expect(uppercase.validate("A")).toBe(true);
        expect(uppercase.validate("abcDEF")).toBe(true);
      });

      it("should fail for passwords without uppercase letters", () => {
        expect(uppercase.validate("password")).toBe(false);
        expect(uppercase.validate("123456")).toBe(false);
        expect(uppercase.validate("")).toBe(false);
      });
    });

    describe("lowercase requirement", () => {
      const lowercase = defaultPasswordRequirements.find((r) => r.id === "lowercase")!;

      it("should exist", () => {
        expect(lowercase).toBeDefined();
        expect(lowercase.label).toBe("At least one lowercase letter");
      });

      it("should pass for passwords with lowercase letters", () => {
        expect(lowercase.validate("Password")).toBe(true);
        expect(lowercase.validate("a")).toBe(true);
        expect(lowercase.validate("ABCdef")).toBe(true);
      });

      it("should fail for passwords without lowercase letters", () => {
        expect(lowercase.validate("PASSWORD")).toBe(false);
        expect(lowercase.validate("123456")).toBe(false);
        expect(lowercase.validate("")).toBe(false);
      });
    });

    describe("number requirement", () => {
      const number = defaultPasswordRequirements.find((r) => r.id === "number")!;

      it("should exist", () => {
        expect(number).toBeDefined();
        expect(number.label).toBe("At least one number");
      });

      it("should pass for passwords with numbers", () => {
        expect(number.validate("Password1")).toBe(true);
        expect(number.validate("123")).toBe(true);
        expect(number.validate("abc123def")).toBe(true);
      });

      it("should fail for passwords without numbers", () => {
        expect(number.validate("Password")).toBe(false);
        expect(number.validate("abcdef")).toBe(false);
        expect(number.validate("")).toBe(false);
      });
    });

    describe("special requirement", () => {
      const special = defaultPasswordRequirements.find((r) => r.id === "special")!;

      it("should exist", () => {
        expect(special).toBeDefined();
        expect(special.label).toBe("At least one special character");
      });

      it("should pass for passwords with special characters", () => {
        expect(special.validate("Password!")).toBe(true);
        expect(special.validate("test@example")).toBe(true);
        expect(special.validate("#$%")).toBe(true);
        expect(special.validate("a.b")).toBe(true);
        expect(special.validate("a,b")).toBe(true);
        expect(special.validate('a"b')).toBe(true);
      });

      it("should fail for passwords without special characters", () => {
        expect(special.validate("Password123")).toBe(false);
        expect(special.validate("abcdef")).toBe(false);
        expect(special.validate("")).toBe(false);
      });
    });

    describe("full password validation", () => {
      it("should validate a strong password against all requirements", () => {
        const strongPassword = "Password1!";
        const allPassed = defaultPasswordRequirements.every((req) => req.validate(strongPassword));
        expect(allPassed).toBe(true);
      });

      it("should fail weak passwords", () => {
        const weakPassword = "password";
        const allPassed = defaultPasswordRequirements.every((req) => req.validate(weakPassword));
        expect(allPassed).toBe(false);
      });
    });
  });

  describe("simplePasswordRequirements", () => {
    it("should have 1 requirement", () => {
      expect(simplePasswordRequirements).toHaveLength(1);
    });

    describe("minLength requirement", () => {
      const minLength = simplePasswordRequirements.find((r) => r.id === "minLength")!;

      it("should exist with 6 character minimum", () => {
        expect(minLength).toBeDefined();
        expect(minLength.label).toBe("At least 6 characters");
      });

      it("should pass for 6+ characters", () => {
        expect(minLength.validate("123456")).toBe(true);
        expect(minLength.validate("abcdefg")).toBe(true);
      });

      it("should fail for less than 6 characters", () => {
        expect(minLength.validate("12345")).toBe(false);
        expect(minLength.validate("")).toBe(false);
      });
    });
  });
});
