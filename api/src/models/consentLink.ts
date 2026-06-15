import mongoose from "mongoose";
import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "../plugins";
import type {ConsentLinkDocument, ConsentLinkModel} from "../types/consentLink";

const consentLinkSchema = new mongoose.Schema<ConsentLinkDocument, ConsentLinkModel>(
  {
    consentFormIds: {
      description:
        "Specific consent forms this link grants access to; empty means all forms currently pending for the user",
      ref: "ConsentForm",
      type: [mongoose.Schema.Types.ObjectId],
    },
    createdByUserId: {
      description: "The admin/user who generated this link, captured for audit purposes",
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
    expiresAt: {
      description: "Timestamp after which the link can no longer be used",
      index: true,
      required: true,
      type: Date,
    },
    lastUsedIp: {
      description: "IP address recorded the last time the link was used, captured for audit",
      type: String,
    },
    maxUses: {
      default: 1,
      description: "Maximum number of times the link may be used; 0 means unlimited until expiry",
      type: Number,
    },
    note: {
      description: "Optional admin note describing why the link was created",
      type: String,
    },
    revoked: {
      default: false,
      description: "Whether the link has been manually revoked by an admin",
      type: Boolean,
    },
    tokenHash: {
      description: "SHA-256 hash of the raw link token; the raw token itself is never stored",
      index: true,
      required: true,
      type: String,
      unique: true,
    },
    useCount: {
      default: 0,
      description: "Number of times the link has been successfully used to submit a consent",
      type: Number,
    },
    usedAt: {
      description: "Timestamp the link was last successfully used to submit a consent",
      type: Date,
    },
    userId: {
      description: "The user this link allows to complete consent forms on behalf of",
      index: true,
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

consentLinkSchema.plugin(createdUpdatedPlugin);
consentLinkSchema.plugin(isDeletedPlugin);
consentLinkSchema.plugin(findOneOrNone);
consentLinkSchema.plugin(findExactlyOne);

export const ConsentLink = mongoose.model<ConsentLinkDocument, ConsentLinkModel>(
  "ConsentLink",
  consentLinkSchema
);
