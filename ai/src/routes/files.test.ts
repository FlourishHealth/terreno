import {beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {createdUpdatedPlugin, setupServer} from "@terreno/api";
import type express from "express";
import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";

import {FileAttachment} from "../models/fileAttachment";
import type {FileStorageService, UploadFileParams, UploadFileResult} from "../service/fileStorage";
import type {FileAttachmentDocument} from "../types";
import {addFileRoutes} from "./files";

type PasswordedUser = {setPassword: (password: string) => Promise<void>};
type MockFileStorageService = Pick<FileStorageService, "upload" | "delete" | "getSignedUrl">;

const userSchema = new mongoose.Schema({
  admin: {default: false, type: Boolean},
  email: {index: true, type: String},
  name: String,
});
userSchema.plugin(
  passportLocalMongoose as unknown as (
    schema: mongoose.Schema,
    options: {usernameField: string}
  ) => void,
  {usernameField: "email"}
);
userSchema.plugin(createdUpdatedPlugin);
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

const authAsUser = async (appInstance: express.Application, type: "admin" | "notAdmin") => {
  const email = type === "admin" ? "admin@example.com" : "notAdmin@example.com";
  const password = type === "admin" ? "securePassword" : "password";
  const agent = supertest.agent(appInstance);
  const res = await agent.post("/auth/login").send({email, password}).expect(200);
  await agent.set("authorization", `Bearer ${res.body.data.token}`);
  return agent;
};

describe("File Routes", () => {
  let app: express.Application;
  let fileStorageService: MockFileStorageService;

  beforeAll(async () => {
    await UserModel.deleteMany({});
    const admin = await UserModel.create({admin: true, email: "admin@example.com", name: "Admin"});
    await (admin as unknown as PasswordedUser).setPassword("securePassword");
    await admin.save();
    const user = await UserModel.create({email: "notAdmin@example.com", name: "User"});
    await (user as unknown as PasswordedUser).setPassword("password");
    await user.save();
  });

  beforeEach(async () => {
    await FileAttachment.deleteMany({});
    fileStorageService = {
      delete: mock(async () => {}),
      getSignedUrl: mock(async () => "https://example.com/signed"),
      upload: mock(
        async (params: UploadFileParams): Promise<UploadFileResult> => ({
          filename: params.filename,
          gcsKey: `uploads/${params.userId.toString()}/${params.filename}`,
          mimeType: params.mimeType,
          size: params.buffer.length,
          url: `https://example.com/${params.filename}`,
        })
      ),
    };
    app = setupServer({
      addRoutes: (router, options) => {
        addFileRoutes(router, {
          fileStorageService: fileStorageService as FileStorageService,
          openApiOptions: options,
        });
      },
      skipListen: true,
      userModel: UserModel,
    });
  });

  describe("POST /files/upload", () => {
    it("uploads a file", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/files/upload")
        .attach("file", Buffer.from("hello"), {contentType: "text/plain", filename: "hi.txt"});
      expect(res.status).toBe(200);
      expect(res.body.data.filename).toBe("hi.txt");
      expect(fileStorageService.upload as ReturnType<typeof mock>).toHaveBeenCalledTimes(1);
    });

    it("rejects when no file is provided", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.post("/files/upload");
      expect(res.status).toBe(400);
    });

    it("rejects unsupported mime types", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.post("/files/upload").attach("file", Buffer.from("<html></html>"), {
        contentType: "application/x-sh",
        filename: "danger.sh",
      });
      expect(res.status).toBe(500);
    });
  });

  describe("GET /files/*gcsKey", () => {
    it("returns 404 when the file is missing", async () => {
      const res = await supertest(app).get("/files/missing/key.txt");
      expect(res.status).toBe(404);
    });

    it("returns the signed URL when the file exists", async () => {
      const owner = (await UserModel.findOne({email: "notAdmin@example.com"})) as
        | (mongoose.Document & {_id: mongoose.Types.ObjectId})
        | null;
      if (!owner) {
        throw new Error("Owner user not found in test setup");
      }
      const attachment: FileAttachmentDocument = await FileAttachment.create({
        filename: "report.pdf",
        gcsKey: "report.pdf",
        mimeType: "application/pdf",
        size: 4,
        url: "https://example.com/report.pdf",
        userId: owner._id,
      });
      const res = await supertest(app).get(`/files/${attachment.gcsKey}`);
      expect(res.status).toBe(200);
      expect(res.body.data.url).toBe("https://example.com/signed");
      expect(fileStorageService.getSignedUrl as ReturnType<typeof mock>).toHaveBeenCalled();
    });
  });

  describe("DELETE /files/*gcsKey", () => {
    it("returns 404 when the file is missing", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.delete("/files/uploads/missing/key.txt");
      expect(res.status).toBe(404);
    });

    it("requires authentication", async () => {
      const res = await supertest(app).delete("/files/any/thing.txt");
      expect(res.status).toBe(401);
    });

    it("returns 403 when the file belongs to another user", async () => {
      const otherOwner = (await UserModel.findOne({email: "admin@example.com"})) as
        | (mongoose.Document & {_id: mongoose.Types.ObjectId})
        | null;
      if (!otherOwner) {
        throw new Error("Other owner user not found in test setup");
      }
      await FileAttachment.create({
        filename: "secret.txt",
        gcsKey: "secret.txt",
        mimeType: "text/plain",
        size: 1,
        url: "https://example.com/secret.txt",
        userId: otherOwner._id,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.delete("/files/secret.txt");
      expect(res.status).toBe(403);
      expect(fileStorageService.delete as ReturnType<typeof mock>).not.toHaveBeenCalled();
    });

    it("deletes a file owned by the authenticated user", async () => {
      const owner = (await UserModel.findOne({email: "notAdmin@example.com"})) as
        | (mongoose.Document & {_id: mongoose.Types.ObjectId})
        | null;
      if (!owner) {
        throw new Error("Owner user not found in test setup");
      }
      await FileAttachment.create({
        filename: "owned.txt",
        gcsKey: "owned.txt",
        mimeType: "text/plain",
        size: 1,
        url: "https://example.com/owned.txt",
        userId: owner._id,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.delete("/files/owned.txt");
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(fileStorageService.delete as ReturnType<typeof mock>).toHaveBeenCalled();
    });
  });
});
