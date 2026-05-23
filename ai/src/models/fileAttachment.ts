import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import mongoose from "mongoose";

import type {FileAttachmentDocument, FileAttachmentModel} from "../types";

const fileAttachmentSchema = new mongoose.Schema<FileAttachmentDocument, FileAttachmentModel>(
  {
    filename: {description: "Original name of the uploaded file", required: true, type: String},
    gcsKey: {
      description: "Google Cloud Storage key identifying this file",
      required: true,
      type: String,
      unique: true,
    },
    mimeType: {description: "MIME type of the uploaded file", required: true, type: String},
    size: {description: "File size in bytes", required: true, type: Number},
    url: {description: "Public or signed URL for accessing the file", required: true, type: String},
    userId: {
      description: "The user who uploaded this file",
      index: true,
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

fileAttachmentSchema.plugin(createdUpdatedPlugin);
fileAttachmentSchema.plugin(isDeletedPlugin);
fileAttachmentSchema.plugin(findOneOrNone);
fileAttachmentSchema.plugin(findExactlyOne);

// Virtual ownerId alias so Permissions.IsOwner works with userId field
fileAttachmentSchema.virtual("ownerId").get(function () {
  return this.userId;
});

export const FileAttachment = mongoose.model<FileAttachmentDocument, FileAttachmentModel>(
  "FileAttachment",
  fileAttachmentSchema
);
