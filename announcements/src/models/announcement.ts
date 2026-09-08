import {
  APIError,
  createdUpdatedPlugin,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
} from "@terreno/api";
import mongoose from "mongoose";
import type {
  AnnouncementDocument,
  AnnouncementModel,
  AnnouncementPlatform,
  AnnouncementPrimaryAction,
} from "../types";

const ALL_PLATFORMS: AnnouncementPlatform[] = ["ios", "android", "web"];

const announcementSchema = new mongoose.Schema<AnnouncementDocument, AnnouncementModel>(
  {
    archivedAt: {
      description: "When the announcement was archived",
      type: Date,
    },
    audience: {
      default: {},
      description: "Opaque targeting metadata consumed by matchAudience callback",
      type: mongoose.Schema.Types.Mixed,
    },
    body: {
      description: "Markdown body shown in the announcement modal",
      required: true,
      trim: true,
      type: String,
    },
    expiresAt: {
      description: "Optional expiry — hidden from pending/feed after this time",
      type: Date,
    },
    platforms: {
      default: ALL_PLATFORMS,
      description: "Platforms that should receive this announcement",
      enum: ALL_PLATFORMS,
      type: [String],
    },
    primaryAction: {
      label: {
        description: "Button label for optional primary action",
        type: String,
      },
      url: {
        description: "Deep link or external URL opened by the primary action button",
        type: String,
      },
    },
    priority: {
      default: 0,
      description: "Higher priority announcements appear first in the modal queue",
      type: Number,
    },
    publishAt: {
      description: "Optional scheduled publish time — hidden until this instant",
      type: Date,
    },
    publishedAt: {
      description: "When the announcement was first published",
      type: Date,
    },
    requiresAcknowledgement: {
      default: false,
      description: "When acknowledgementMode is admin, users must acknowledge before dismissal",
      type: Boolean,
    },
    status: {
      default: "draft",
      description: "Lifecycle status: draft, published, or archived",
      enum: ["draft", "published", "archived"],
      required: true,
      type: String,
    },
    title: {
      description: "Announcement title shown in modal and changelog feed",
      required: true,
      trim: true,
      type: String,
    },
    version: {
      default: 1,
      description: "Content version — increments when published title/body changes",
      min: 1,
      type: Number,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

announcementSchema.plugin(createdUpdatedPlugin);
announcementSchema.plugin(isDeletedPlugin);
announcementSchema.plugin(findExactlyOne);
announcementSchema.plugin(findOneOrNone);

announcementSchema.index({publishAt: 1, status: 1});
announcementSchema.index({priority: -1, publishedAt: -1, status: 1});

announcementSchema.pre("save", async function bumpVersionOnPublishedEdit() {
  if (this.isNew) {
    return;
  }
  if (this.status !== "published") {
    return;
  }
  if (!this.isModified("title") && !this.isModified("body")) {
    return;
  }

  const previous = await Announcement.findById(this._id).select("title body status version");
  if (previous?.status !== "published") {
    return;
  }
  if (previous.title === this.title && previous.body === this.body) {
    return;
  }

  this.version = (previous.version ?? 1) + 1;
});

announcementSchema.pre("validate", function validatePrimaryAction() {
  const action = this.primaryAction as AnnouncementPrimaryAction | undefined;
  if (!action) {
    return;
  }
  const hasLabel = Boolean(action.label?.trim());
  const hasUrl = Boolean(action.url?.trim());
  if (!hasLabel && !hasUrl) {
    this.primaryAction = undefined;
    return;
  }
  if (!hasLabel || !hasUrl) {
    throw new APIError({
      status: 400,
      title: "primaryAction requires both label and url when provided",
    });
  }
});

export const Announcement =
  (mongoose.models.Announcement as AnnouncementModel) ??
  mongoose.model<AnnouncementDocument, AnnouncementModel>("Announcement", announcementSchema);

export const toAnnouncementPublic = (
  doc: AnnouncementDocument
): import("../types").AnnouncementPublic => ({
  body: doc.body,
  id: doc._id.toString(),
  primaryAction: doc.primaryAction,
  priority: doc.priority,
  publishedAt: doc.publishedAt?.toISOString(),
  requiresAcknowledgement: doc.requiresAcknowledgement,
  title: doc.title,
  version: doc.version,
});
