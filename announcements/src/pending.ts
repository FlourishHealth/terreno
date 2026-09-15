import {DateTime} from "luxon";
import type {
  AcknowledgementPolicy,
  AnnouncementAudienceType,
  AnnouncementDisplayMode,
  AnnouncementDocument,
  AnnouncementPlatform,
} from "./types";

export interface AnnouncementAckState {
  announcementId: string;
  version: number;
}

export interface AnnouncementImpressionState {
  announcementId: string;
  version: number;
}

type AnnouncementWithLegacyAck = AnnouncementDocument & {
  requiresAcknowledgement?: boolean;
};

export const resolveAcknowledgementPolicy = ({
  announcement,
  defaultAcknowledgementPolicy = "dismiss-only",
}: {
  announcement: AnnouncementDocument;
  defaultAcknowledgementPolicy?: AcknowledgementPolicy;
}): AcknowledgementPolicy => {
  if (announcement.acknowledgementPolicy) {
    return announcement.acknowledgementPolicy;
  }

  const legacyRequiresAck = (announcement as AnnouncementWithLegacyAck).requiresAcknowledgement;
  if (legacyRequiresAck === true) {
    return "required";
  }

  return defaultAcknowledgementPolicy;
};

export const requiresAcknowledgementForAnnouncement = ({
  announcement,
  defaultAcknowledgementPolicy = "dismiss-only",
}: {
  announcement: AnnouncementDocument;
  defaultAcknowledgementPolicy?: AcknowledgementPolicy;
}): boolean => {
  const policy = resolveAcknowledgementPolicy({announcement, defaultAcknowledgementPolicy});
  return policy === "required";
};

export const resolveDisplayMode = (announcement: AnnouncementDocument): AnnouncementDisplayMode => {
  const mode = announcement.displayMode;
  if (mode === "modal" || mode === "banner" || mode === "feed") {
    return mode;
  }
  return "modal";
};

export const resolveAudienceType = (
  announcement: AnnouncementDocument
): AnnouncementAudienceType => {
  const audienceType = announcement.audienceType;
  if (audienceType === "staff" || audienceType === "patient" || audienceType === "all") {
    return audienceType;
  }
  return "all";
};

export const matchAudienceByType = ({
  announcement,
  isStaff,
  user,
}: {
  announcement: AnnouncementDocument;
  isStaff: (user: unknown) => boolean;
  user: unknown;
}): boolean => {
  const audienceType = resolveAudienceType(announcement);
  if (audienceType === "all") {
    return true;
  }

  const staff = isStaff(user);
  if (audienceType === "staff") {
    return staff;
  }

  return !staff;
};

export const parseQueryVersion = (raw: unknown): number | undefined => {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
};

export const passesMinBuildNumber = ({
  announcement,
  queryVersion,
}: {
  announcement: AnnouncementDocument;
  queryVersion?: number;
}): boolean => {
  const minBuildNumber = announcement.minBuildNumber;
  if (minBuildNumber === undefined || minBuildNumber === null || minBuildNumber === 0) {
    return true;
  }

  if (queryVersion === undefined) {
    return true;
  }

  return queryVersion >= minBuildNumber;
};

export const isInterruptDisplayMode = (announcement: AnnouncementDocument): boolean => {
  const displayMode = resolveDisplayMode(announcement);
  return displayMode === "modal" || displayMode === "banner";
};

export const isAnnouncementVisibleNow = ({
  announcement,
  now = DateTime.utc(),
}: {
  announcement: AnnouncementDocument;
  now?: DateTime;
}): boolean => {
  if (announcement.status !== "published") {
    return false;
  }

  if (announcement.publishAt) {
    const publishAt = DateTime.fromJSDate(announcement.publishAt);
    if (publishAt > now) {
      return false;
    }
  }

  if (announcement.expiresAt) {
    const expiresAt = DateTime.fromJSDate(announcement.expiresAt);
    if (expiresAt <= now) {
      return false;
    }
  }

  return true;
};

export const matchesPlatform = ({
  announcement,
  platform,
}: {
  announcement: AnnouncementDocument;
  platform: AnnouncementPlatform;
}): boolean => {
  const platforms = announcement.platforms?.length
    ? announcement.platforms
    : (["ios", "android", "web"] as AnnouncementPlatform[]);
  return platforms.includes(platform);
};

export const isAnnouncementPendingForUser = ({
  acknowledgements,
  announcement,
  defaultAcknowledgementPolicy = "dismiss-only",
  impressions,
}: {
  acknowledgements: AnnouncementAckState[];
  announcement: AnnouncementDocument;
  defaultAcknowledgementPolicy?: AcknowledgementPolicy;
  impressions: AnnouncementImpressionState[];
}): boolean => {
  const announcementId = announcement._id.toString();
  const needsAck = requiresAcknowledgementForAnnouncement({
    announcement,
    defaultAcknowledgementPolicy,
  });

  if (needsAck) {
    const hasAck = acknowledgements.some(
      (ack) => ack.announcementId === announcementId && ack.version === announcement.version
    );
    return !hasAck;
  }

  const hasImpression = impressions.some(
    (impression) =>
      impression.announcementId === announcementId && impression.version === announcement.version
  );
  return !hasImpression;
};

export const sortAnnouncementsForQueue = (
  announcements: AnnouncementDocument[]
): AnnouncementDocument[] =>
  [...announcements].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    const rightPublished = right.publishedAt?.getTime() ?? 0;
    const leftPublished = left.publishedAt?.getTime() ?? 0;
    return rightPublished - leftPublished;
  });

export const selectPendingAnnouncements = ({
  acknowledgements,
  announcements,
  defaultAcknowledgementPolicy = "dismiss-only",
  impressions,
  now,
  platform,
  queryVersion,
}: {
  acknowledgements: AnnouncementAckState[];
  announcements: AnnouncementDocument[];
  defaultAcknowledgementPolicy?: AcknowledgementPolicy;
  impressions: AnnouncementImpressionState[];
  now?: DateTime;
  platform: AnnouncementPlatform;
  queryVersion?: number;
}): AnnouncementDocument[] => {
  const visible = announcements.filter((announcement) => {
    if (!isAnnouncementVisibleNow({announcement, now})) {
      return false;
    }
    if (!matchesPlatform({announcement, platform})) {
      return false;
    }
    if (!isInterruptDisplayMode(announcement)) {
      return false;
    }
    if (!passesMinBuildNumber({announcement, queryVersion})) {
      return false;
    }
    return isAnnouncementPendingForUser({
      acknowledgements,
      announcement,
      defaultAcknowledgementPolicy,
      impressions,
    });
  });

  return sortAnnouncementsForQueue(visible);
};
