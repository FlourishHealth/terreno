import {describe, expect, it} from "bun:test";

import {
  Announcement,
  AnnouncementsApp,
  excerptBody,
  isAnnouncementPendingForUser,
  toAnnouncementPublic,
} from "../index";

describe("@terreno/announcements package exports", () => {
  it("re-exports the announcements plugin surface", () => {
    expect(typeof AnnouncementsApp).toBe("function");
    expect(Announcement.modelName).toBe("Announcement");
    expect(excerptBody("hello world")).toBe("hello world");
    expect(
      isAnnouncementPendingForUser({
        acknowledgementMode: "always",
        acknowledgements: [],
        announcement: {
          _id: "a",
          body: "Body",
          priority: 1,
          publishedAt: new Date(),
          requiresAcknowledgement: true,
          status: "published",
          title: "Title",
          version: 1,
        } as never,
        impressions: [],
      })
    ).toBe(true);
    const announcement = {
      _id: "a",
      body: "Body",
      priority: 1,
      publishedAt: new Date(),
      requiresAcknowledgement: false,
      status: "published",
      title: "Title",
      version: 1,
    } as never;
    expect(toAnnouncementPublic(announcement).id).toBe("a");
    expect(toAnnouncementPublic(announcement, "always").requiresAcknowledgement).toBe(true);
    expect(toAnnouncementPublic(announcement, "never").requiresAcknowledgement).toBe(false);
  });
});
