import {Storage} from "@google-cloud/storage";

import {FileAttachment} from "../models/fileAttachment";

export interface UploadFileParams {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  userId: import("mongoose").Types.ObjectId;
}

export interface UploadFileResult {
  filename: string;
  gcsKey: string;
  mimeType: string;
  size: number;
  url: string;
}

export class FileStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor({bucketName}: {bucketName: string}) {
    this.storage = new Storage();
    this.bucketName = bucketName;
  }

  private get bucket() {
    return this.storage.bucket(this.bucketName);
  }

  async upload({buffer, filename, mimeType, userId}: UploadFileParams): Promise<UploadFileResult> {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const gcsKey = `uploads/${userId.toString()}/${timestamp}-${sanitizedFilename}`;

    const file = this.bucket.file(gcsKey);
    await file.save(buffer, {
      contentType: mimeType,
      metadata: {userId: userId.toString()},
    });

    const url = `https://storage.googleapis.com/${this.bucketName}/${gcsKey}`;

    await FileAttachment.create({
      filename,
      gcsKey,
      mimeType,
      size: buffer.length,
      url,
      userId,
    });

    return {filename, gcsKey, mimeType, size: buffer.length, url};
  }

  async getSignedUrl(gcsKey: string): Promise<string> {
    const file = this.bucket.file(gcsKey);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
      version: "v4",
    });
    return url;
  }

  async delete(gcsKey: string): Promise<void> {
    const file = this.bucket.file(gcsKey);
    await file.delete({ignoreNotFound: true});

    await FileAttachment.findOneAndUpdate({gcsKey}, {deleted: true});
  }
}
