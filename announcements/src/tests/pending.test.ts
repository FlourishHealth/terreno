import {describe, expect, it} from "bun:test";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import {
  isAnnouncementPendingForUser,
  isAnnouncementVisibleNow,
  requiresAcknowledgementForAnnouncement,
  selectPendingAnnouncements,
} from "../pending";
import type {AnnouncementDocument} from "../types";

const makeAnnouncement = (overrides: Partial<AnnouncementDocument> = {}): AnnouncementDocument => ({
  _id: new mongoose.Types.ObjectId(),
  audience: {},
  body: "Body",
  created: new Date(),
  expiresAt: undefined,
  platforms: ["ios", "android", "web"],
  priority: 0,
  publishAt: undefined,
  publishedAt: DateTime.utc().minus({days: 1}).toJSDate(),
  requiresAcknowledgement: true,
  status: "published",
  title: "Title",
  updated: new Date(),
  version: 1,
  ...overrides,
});

describe("pending helpers", () => {
  it("requires acknowledgement based on mode and announcement flag", () => {
    const announcement = makeAnnouncement({requiresAcknowledgement: false});
    expect(
      requiresAcknowledgementForAnnouncement({acknowledgementMode: "admin", announcement})
    ).toBe(false);
    expect(
      requiresAcknowledgementForAnnouncement({acknowledgementMode: "always", announcement})
    ).toBe(true);
    expect(
      requiresAcknowledgementForAnnouncement({acknowledgementMode: "never", announcement})
    ).toBe(false);
  });

  it("filters announcements outside the publish window", () => {
    const future = makeAnnouncement({
      publishAt: DateTime.utc().plus({days: 1}).toJSDate(),
    });
    const expired = makeAnnouncement({
      expiresAt: DateTime.utc().minus({hours: 1}).toJSDate(),
    });
    expect(isAnnouncementVisibleNow({announcement: future})).toBe(false);
    expect(isAnnouncementVisibleNow({announcement: expired})).toBe(false);
    expect(isAnnouncementVisibleNow({announcement: makeAnnouncement()})).toBe(true);
  });

  it("returns pending announcements until acknowledged or impressed", () => {
    const announcement = makeAnnouncement({requiresAcknowledgement: true});
    const announcementId = announcement._id.toString();

    expect(
      isAnnouncementPendingForUser({
        acknowledgementMode: "admin",
        acknowledgements: [],
        announcement,
        impressions: [],
      })
    ).toBe(true);

    expect(
      isAnnouncementPendingForUser({
        acknowledgementMode: "admin",
        acknowledgements: [{announcementId, version: 1}],
        announcement,
        impressions: [],
      })
    ).toBe(false);

    const dismissOnly = makeAnnouncement({requiresAcknowledgement: false});
    const dismissId = dismissOnly._id.toString();
    expect(
      isAnnouncementPendingForUser({
        acknowledgementMode: "admin",
        acknowledgements: [],
        announcement: dismissOnly,
        impressions: [{announcementId: dismissId, version: 1}],
      })
    ).toBe(false);
  });

  it("sorts by priority then publishedAt", () => {
    const low = makeAnnouncement({
      priority: 1,
      publishedAt: DateTime.utc().minus({days: 1}).toJSDate(),
    });
    const high = makeAnnouncement({
      priority: 10,
      publishedAt: DateTime.utc().minus({days: 2}).toJSDate(),
    });
    const pending = selectPendingAnnouncements({
      acknowledgementMode: "always",
      acknowledgements: [],
      announcements: [low, high],
      impressions: [],
      platform: "web",
    });
    expect(pending[0]?._id.toString()).toBe(high._id.toString());
  });
});
