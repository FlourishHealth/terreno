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
    expect(
      toAnnouncementPublic({
        _id: "a",
        body: "Body",
        priority: 1,
        publishedAt: new Date(),
        requiresAcknowledgement: false,
        status: "published",
        title: "Title",
        version: 1,
      } as never).id
    ).toBe("a");
  });
});
