import {DateTime} from "luxon";
import type {AcknowledgementMode, AnnouncementDocument, AnnouncementPlatform} from "./types";

export interface AnnouncementAckState {
  announcementId: string;
  version: number;
}

export interface AnnouncementImpressionState {
  announcementId: string;
  version: number;
}

export const requiresAcknowledgementForAnnouncement = ({
  acknowledgementMode,
  announcement,
}: {
  acknowledgementMode: AcknowledgementMode;
  announcement: AnnouncementDocument;
}): boolean => {
  if (acknowledgementMode === "always") {
    return true;
  }
  if (acknowledgementMode === "never") {
    return false;
  }
  return announcement.requiresAcknowledgement;
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
  acknowledgementMode,
  acknowledgements,
  announcement,
  impressions,
}: {
  acknowledgementMode: AcknowledgementMode;
  acknowledgements: AnnouncementAckState[];
  announcement: AnnouncementDocument;
  impressions: AnnouncementImpressionState[];
}): boolean => {
  const announcementId = announcement._id.toString();
  const needsAck = requiresAcknowledgementForAnnouncement({acknowledgementMode, announcement});

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
  acknowledgementMode,
  acknowledgements,
  announcements,
  impressions,
  now,
  platform,
}: {
  acknowledgementMode: AcknowledgementMode;
  acknowledgements: AnnouncementAckState[];
  announcements: AnnouncementDocument[];
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
      acknowledgementMode,
      acknowledgements,
      announcement,
      impressions,
    });
  });

  return sortAnnouncementsForQueue(visible);
};
