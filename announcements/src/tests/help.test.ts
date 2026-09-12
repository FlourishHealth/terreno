import {describe, expect, it} from "bun:test";
import {excerptBody, matchesHelpQueries, toHelpSummary} from "../help";

describe("announcement help helpers", () => {
  it("matches any active query against title or body", () => {
    const doc = {body: "Markdown body about syncdb", title: "Welcome"};
    expect(matchesHelpQueries(doc, ["syncdb"])).toBe(true);
    expect(matchesHelpQueries(doc, ["missing"])).toBe(false);
    expect(matchesHelpQueries(doc, [])).toBe(true);
  });

  it("builds excerpts and summaries", () => {
    const summary = toHelpSummary({
      _id: "507f1f77bcf86cd799439011",
      body: "Line one\n\nLine two",
      created: new Date(),
      platforms: ["web"],
      priority: 1,
      requiresAcknowledgement: false,
      status: "published",
      title: "Hello",
      updated: new Date(),
      version: 2,
    } as never);
    expect(summary.excerpt).toBe(excerptBody("Line one\n\nLine two"));
    expect(summary.title).toBe("Hello");
    expect(summary.version).toBe(2);
  });
});
