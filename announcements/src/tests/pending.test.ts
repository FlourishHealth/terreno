import {describe, expect, it} from "bun:test";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import {
  isAnnouncementPendingForUser,
  isAnnouncementVisibleNow,
  requiresAcknowledgementForAnnouncement,
  resolveAcknowledgementPolicy,
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
  status: "published",
  title: "Title",
  updated: new Date(),
  version: 1,
  ...overrides,
});

describe("pending helpers", () => {
  it("resolves acknowledgement policy from field, default, and legacy boolean", () => {
    expect(
      resolveAcknowledgementPolicy({
        announcement: makeAnnouncement({acknowledgementPolicy: "required"}),
      })
    ).toBe("required");
    expect(
      resolveAcknowledgementPolicy({
        announcement: makeAnnouncement({acknowledgementPolicy: "dismiss-only"}),
      })
    ).toBe("dismiss-only");
    expect(
      resolveAcknowledgementPolicy({
        announcement: makeAnnouncement({}),
        defaultAcknowledgementPolicy: "required",
      })
    ).toBe("required");
    expect(
      resolveAcknowledgementPolicy({
        announcement: makeAnnouncement({}),
      })
    ).toBe("dismiss-only");

    const legacyRequired = makeAnnouncement({}) as AnnouncementDocument & {
      requiresAcknowledgement: boolean;
    };
    legacyRequired.requiresAcknowledgement = true;
    expect(resolveAcknowledgementPolicy({announcement: legacyRequired})).toBe("required");

    const legacyFalse = makeAnnouncement({}) as AnnouncementDocument & {
      requiresAcknowledgement: boolean;
    };
    legacyFalse.requiresAcknowledgement = false;
    expect(
      resolveAcknowledgementPolicy({
        announcement: legacyFalse,
        defaultAcknowledgementPolicy: "required",
      })
    ).toBe("required");
  });

  it("maps resolved policy to requiresAcknowledgement boolean", () => {
    expect(
      requiresAcknowledgementForAnnouncement({
        announcement: makeAnnouncement({acknowledgementPolicy: "required"}),
      })
    ).toBe(true);
    expect(
      requiresAcknowledgementForAnnouncement({
        announcement: makeAnnouncement({acknowledgementPolicy: "dismiss-only"}),
      })
    ).toBe(false);
    expect(
      requiresAcknowledgementForAnnouncement({
        announcement: makeAnnouncement({}),
        defaultAcknowledgementPolicy: "required",
      })
    ).toBe(true);
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
    const announcement = makeAnnouncement({acknowledgementPolicy: "required"});
    const announcementId = announcement._id.toString();

    expect(
      isAnnouncementPendingForUser({
        acknowledgements: [],
        announcement,
        impressions: [],
      })
    ).toBe(true);

    expect(
      isAnnouncementPendingForUser({
        acknowledgements: [{announcementId, version: 1}],
        announcement,
        impressions: [],
      })
    ).toBe(false);

    const dismissOnly = makeAnnouncement({acknowledgementPolicy: "dismiss-only"});
    const dismissId = dismissOnly._id.toString();
    expect(
      isAnnouncementPendingForUser({
        acknowledgements: [],
        announcement: dismissOnly,
        impressions: [{announcementId: dismissId, version: 1}],
      })
    ).toBe(false);
  });

  it("sorts by priority then publishedAt", () => {
    const low = makeAnnouncement({
      acknowledgementPolicy: "required",
      priority: 1,
      publishedAt: DateTime.utc().minus({days: 1}).toJSDate(),
    });
    const high = makeAnnouncement({
      acknowledgementPolicy: "required",
      priority: 10,
      publishedAt: DateTime.utc().minus({days: 2}).toJSDate(),
    });
    const pending = selectPendingAnnouncements({
      acknowledgements: [],
      announcements: [low, high],
      impressions: [],
      platform: "web",
    });
    expect(pending[0]?._id.toString()).toBe(high._id.toString());
  });
});
