// biome-ignore-all lint/suspicious/noExplicitAny: tests
import {beforeEach, describe, expect, it} from "bun:test";
import type {Request, Response} from "express";
import {User} from "../models/user";
import {GET} from "./health";

// Mock response type with our custom properties
interface MockResponse extends Partial<Response> {
  jsonData?: any;
  statusCode?: number;
}

// Mock request and response objects
const createMockReq = (): Partial<Request> => ({});

const createMockRes = (): MockResponse => {
  const res: MockResponse = {
    jsonData: undefined,
    statusCode: 200,
  };

  res.json = function (this: MockResponse, data: any) {
    this.jsonData = data;
    return this as any;
  };

  res.status = function (this: MockResponse, code: number) {
    this.statusCode = code;
    return this as any;
  };

  return res;
};

describe("Health API", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("GET /api/health", () => {
    it("should return ok status when users exist", async () => {
      // Create a test user
      await User.create({
        email: "test@example.com",
        name: "Test User",
      });

      const req = createMockReq();
      const res = createMockRes();

      await GET(req as Request, res as Response);

      expect(res).toBeDefined();
      expect(res.jsonData?.status).toBe("ok");
      expect(res.jsonData?.timestamp).toBeDefined();
      expect(res.jsonData?.userCount).toBe(1);
    });

    it("should throw error when no users exist", async () => {
      const req = createMockReq();
      const res = createMockRes();

      try {
        await GET(req as Request, res as Response);
        throw new Error("Should have thrown error");
      } catch (error: unknown) {
        const err = error as {status?: number; title?: string};
        expect(err.status).toBeDefined();
        expect(err.status).toBe(503);
        assert.include(err.title?.toLowerCase() ?? "", "no users found");
      }
    });

    it("should return valid timestamp", async () => {
      await User.create({
        email: "test@example.com",
        name: "Test User",
      });

      const req = createMockReq();
      const res = createMockRes();

      const before = new Date();
      await GET(req as Request, res as Response);
      const after = new Date();

      expect(res.jsonData?.timestamp).toBeDefined();
      const timestamp = new Date(res.jsonData?.timestamp);
      expect(timestamp >= before && timestamp <= after).toBe(true);
    });

    it("should only fetch one user", async () => {
      // Create multiple users
      await User.create([
        {email: "user1@example.com", name: "User 1"},
        {email: "user2@example.com", name: "User 2"},
        {email: "user3@example.com", name: "User 3"},
      ]);

      const req = createMockReq();
      const res = createMockRes();

      await GET(req as Request, res as Response);

      expect(res.jsonData).toBeDefined();
      expect(res.jsonData?.userCount).toBe(1);
    });
  });
});
