import {DateTime} from "luxon";
import type {AcknowledgementPolicy, AnnouncementDocument, AnnouncementPlatform} from "./types";

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
}: {
  acknowledgements: AnnouncementAckState[];
  announcements: AnnouncementDocument[];
  defaultAcknowledgementPolicy?: AcknowledgementPolicy;
  impressions: AnnouncementImpressionState[];
  now?: DateTime;
  platform: AnnouncementPlatform;
}): AnnouncementDocument[] => {
  const visible = announcements.filter((announcement) => {
    if (!isAnnouncementVisibleNow({announcement, now})) {
      return false;
    }
    if (!matchesPlatform({announcement, platform})) {
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
