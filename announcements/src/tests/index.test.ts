import {describe, expect, it} from "bun:test";

import {
  Announcement,
  AnnouncementsApp,
  excerptBody,
  isAnnouncementPendingForUser,
  resolveAcknowledgementPolicy,
  toAnnouncementPublic,
} from "../index";

describe("@terreno/announcements package exports", () => {
  it("re-exports the announcements plugin surface", () => {
    expect(typeof AnnouncementsApp).toBe("function");
    expect(Announcement.modelName).toBe("Announcement");
    expect(excerptBody("hello world")).toBe("hello world");
    expect(
      isAnnouncementPendingForUser({
        acknowledgements: [],
        announcement: {
          _id: "a",
          acknowledgementPolicy: "required",
          body: "Body",
          priority: 1,
          publishedAt: new Date(),
          status: "published",
          title: "Title",
          version: 1,
        } as never,
        impressions: [],
      })
    ).toBe(true);
    const dismissOnly = {
      _id: "a",
      acknowledgementPolicy: "dismiss-only",
      body: "Body",
      priority: 1,
      publishedAt: new Date(),
      status: "published",
      title: "Title",
      version: 1,
    } as never;
    const omittedPolicy = {
      _id: "b",
      body: "Body",
      priority: 1,
      publishedAt: new Date(),
      status: "published",
      title: "Title",
      version: 1,
    } as never;
    expect(toAnnouncementPublic(dismissOnly).id).toBe("a");
    expect(toAnnouncementPublic(dismissOnly).requiresAcknowledgement).toBe(false);
    expect(toAnnouncementPublic(omittedPolicy, "required").requiresAcknowledgement).toBe(true);
    expect(resolveAcknowledgementPolicy({announcement: dismissOnly})).toBe("dismiss-only");
  });
});
