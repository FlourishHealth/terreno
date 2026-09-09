import type {PermissionMethod} from "@terreno/api";
import type {Model, Types} from "mongoose";

export type AnnouncementStatus = "draft" | "published" | "archived";
export type AnnouncementPlatform = "ios" | "android" | "web";
export type AcknowledgementMode = "admin" | "always" | "never";

export interface AnnouncementPrimaryAction {
  label: string;
  url: string;
}

export interface AnnouncementDocument {
  _id: Types.ObjectId;
  title: string;
  body: string;
  status: AnnouncementStatus;
  version: number;
  priority: number;
  requiresAcknowledgement: boolean;
  audience: unknown;
  publishAt?: Date;
  expiresAt?: Date;
  platforms: AnnouncementPlatform[];
  primaryAction?: AnnouncementPrimaryAction;
  publishedAt?: Date;
  archivedAt?: Date;
  created: Date;
  updated: Date;
}

export type AnnouncementModel = Model<AnnouncementDocument>;

export interface AnnouncementAcknowledgementDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  announcementId: Types.ObjectId;
  version: number;
  acknowledgedAt: Date;
  created: Date;
  updated: Date;
}

export type AnnouncementAcknowledgementModel = Model<AnnouncementAcknowledgementDocument>;

export interface AnnouncementImpressionDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  announcementId: Types.ObjectId;
  version: number;
  viewedAt: Date;
  platform?: AnnouncementPlatform;
  created: Date;
  updated: Date;
}

export type AnnouncementImpressionModel = Model<AnnouncementImpressionDocument>;

export interface AnnouncementPublic {
  id: string;
  title: string;
  body: string;
  version: number;
  priority: number;
  requiresAcknowledgement: boolean;
  primaryAction?: AnnouncementPrimaryAction;
  publishedAt?: string;
}

export type MatchAudienceFunction = (
  user: unknown,
  announcement: AnnouncementDocument
) => boolean | Promise<boolean>;

export interface AnnouncementsHelpOptions {
  /** When true, registers GET /announcements/help/search and GET /announcements/help/:id for MCP and in-app help. */
  enabled?: boolean;
}

export interface AnnouncementsOptions {
  acknowledgementMode?: AcknowledgementMode;
  basePath?: string;
  help?: AnnouncementsHelpOptions;
  matchAudience?: MatchAudienceFunction;
  permissions?: Partial<{
    create: PermissionMethod<AnnouncementDocument>[];
    delete: PermissionMethod<AnnouncementDocument>[];
    list: PermissionMethod<AnnouncementDocument>[];
    read: PermissionMethod<AnnouncementDocument>[];
    update: PermissionMethod<AnnouncementDocument>[];
  }>;
}
