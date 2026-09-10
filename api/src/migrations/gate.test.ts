import {describe, expect, it} from "bun:test";

import {APIError} from "../errors";
import {assertMigrationsAllowed} from "./gate";

describe("assertMigrationsAllowed", () => {
  it("allows dry-run in production without ALLOW_MIGRATIONS or force", () => {
    expect(() => {
      assertMigrationsAllowed({
        allowEnv: false,
        dryRun: true,
        force: false,
        isProduction: true,
      });
    }).not.toThrow();
  });

  it("allows wet runs outside production without force", () => {
    expect(() => {
      assertMigrationsAllowed({
        allowEnv: false,
        dryRun: false,
        force: false,
        isProduction: false,
      });
    }).not.toThrow();
  });

  it("denies wet production when ALLOW_MIGRATIONS is unset", () => {
    expect(() => {
      assertMigrationsAllowed({
        allowEnv: false,
        dryRun: false,
        force: true,
        isProduction: true,
      });
    }).toThrow(APIError);
    try {
      assertMigrationsAllowed({
        allowEnv: false,
        dryRun: false,
        force: true,
        isProduction: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).status).toBe(403);
      expect((error as APIError).title).toBe("Migrations not allowed");
    }
  });

  it("denies wet production when ALLOW_MIGRATIONS is set but force is missing", () => {
    expect(() => {
      assertMigrationsAllowed({
        allowEnv: true,
        dryRun: false,
        force: false,
        isProduction: true,
      });
    }).toThrow("Migrations not allowed");
  });

  it("allows wet production when ALLOW_MIGRATIONS and force are both set", () => {
    expect(() => {
      assertMigrationsAllowed({
        allowEnv: true,
        dryRun: false,
        force: true,
        isProduction: true,
      });
    }).not.toThrow();
  });
});
