import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {FileAttachment} from "./fileAttachment";

describe("FileAttachment Model", () => {
  beforeEach(async () => {
    await FileAttachment.deleteMany({});
  });

  afterEach(async () => {
    await FileAttachment.deleteMany({});
  });

  describe("schema", () => {
    it("should create a file attachment with required fields", async () => {
      const userId = new mongoose.Types.ObjectId();
      const attachment = await FileAttachment.create({
        filename: "test.pdf",
        gcsKey: "uploads/user123/1234-test.pdf",
        mimeType: "application/pdf",
        size: 1024,
        url: "https://storage.googleapis.com/bucket/uploads/user123/1234-test.pdf",
        userId,
      });

      expect(attachment.filename).toBe("test.pdf");
      expect(attachment.gcsKey).toBe("uploads/user123/1234-test.pdf");
      expect(attachment.mimeType).toBe("application/pdf");
      expect(attachment.size).toBe(1024);
      expect(attachment.url).toContain("storage.googleapis.com");
      expect(attachment.userId.toString()).toBe(userId.toString());
      expect(attachment.created).toBeDefined();
      expect(attachment.deleted).toBe(false);
    });

    it("should require filename", async () => {
      const userId = new mongoose.Types.ObjectId();
      await expect(
        FileAttachment.create({
          gcsKey: "key",
          mimeType: "text/plain",
          size: 100,
          url: "https://example.com/file",
          userId,
        })
      ).rejects.toThrow();
    });

    it("should require gcsKey", async () => {
      const userId = new mongoose.Types.ObjectId();
      await expect(
        FileAttachment.create({
          filename: "test.txt",
          mimeType: "text/plain",
          size: 100,
          url: "https://example.com/file",
          userId,
        })
      ).rejects.toThrow();
    });

    it("should enforce unique gcsKey", async () => {
      const userId = new mongoose.Types.ObjectId();
      const data = {
        filename: "test.pdf",
        gcsKey: "uploads/unique-key",
        mimeType: "application/pdf",
        size: 1024,
        url: "https://example.com/file",
        userId,
      };

      await FileAttachment.create(data);
      await expect(FileAttachment.create(data)).rejects.toThrow();
    });

    it("should have virtual ownerId field", async () => {
      const userId = new mongoose.Types.ObjectId();
      const attachment = await FileAttachment.create({
        filename: "test.txt",
        gcsKey: "uploads/key",
        mimeType: "text/plain",
        size: 100,
        url: "https://example.com/file",
        userId,
      });

      expect((attachment as any).ownerId.toString()).toBe(userId.toString());
    });
  });

  describe("soft delete", () => {
    it("should filter out deleted records by default", async () => {
      const userId = new mongoose.Types.ObjectId();
      await FileAttachment.create({
        deleted: true,
        filename: "deleted.txt",
        gcsKey: "uploads/deleted",
        mimeType: "text/plain",
        size: 100,
        url: "https://example.com/deleted",
        userId,
      });
      await FileAttachment.create({
        filename: "active.txt",
        gcsKey: "uploads/active",
        mimeType: "text/plain",
        size: 200,
        url: "https://example.com/active",
        userId,
      });

      const results = await FileAttachment.find({});
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe("active.txt");
    });
  });
});
