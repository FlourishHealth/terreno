import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import mongoose from "mongoose";

import type {FileAttachmentDocument, FileAttachmentModel} from "../types";

const fileAttachmentSchema = new mongoose.Schema<FileAttachmentDocument, FileAttachmentModel>(
  {
    filename: {required: true, type: String},
    gcsKey: {required: true, type: String, unique: true},
    mimeType: {required: true, type: String},
    size: {required: true, type: Number},
    url: {required: true, type: String},
    userId: {index: true, ref: "User", required: true, type: mongoose.Schema.Types.ObjectId},
  },
  {strict: true, toJSON: {virtuals: true}, toObject: {virtuals: true}}
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
