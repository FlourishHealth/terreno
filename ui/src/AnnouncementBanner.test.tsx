import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {Linking} from "react-native";

import {AnnouncementBanner} from "./AnnouncementBanner";
import {renderWithTheme} from "./test-utils";
import type {AnnouncementPublic} from "./useAnnouncements";

const makeAnnouncement = (overrides: Partial<AnnouncementPublic> = {}): AnnouncementPublic => ({
  body: "Body",
  displayMode: "banner",
  id: "announcement-1",
  priority: 1,
  requiresAcknowledgement: false,
  title: "Banner title",
  version: 1,
  ...overrides,
});

describe("AnnouncementBanner", () => {
  it("renders the announcement title", () => {
    const result = renderWithTheme(
      <AnnouncementBanner
        announcement={makeAnnouncement()}
        onAcknowledge={() => {}}
        onDismiss={() => {}}
        requiresAcknowledgement={false}
      />
    );
    assert.ok(result.getByText("Banner title"));
  });

  it("calls onAcknowledge when acknowledgement is required", async () => {
    const onAcknowledge = mock(() => Promise.resolve());
    const result = renderWithTheme(
      <AnnouncementBanner
        announcement={makeAnnouncement({requiresAcknowledgement: true})}
        onAcknowledge={onAcknowledge}
        onDismiss={() => {}}
        requiresAcknowledgement
      />
    );

    await act(async () => {
      fireEvent.press(result.getByText("Got it"));
    });

    assert.strictEqual(onAcknowledge.mock.calls.length, 1);
  });

  it("calls onDismiss for dismiss-only banners without a primary action", async () => {
    const onDismiss = mock(() => Promise.resolve());
    const result = renderWithTheme(
      <AnnouncementBanner
        announcement={makeAnnouncement()}
        onAcknowledge={() => {}}
        onDismiss={onDismiss}
        requiresAcknowledgement={false}
      />
    );

    await act(async () => {
      fireEvent.press(result.getByText("Dismiss"));
    });

    assert.strictEqual(onDismiss.mock.calls.length, 1);
  });

  it("opens the primary action URL and exposes a dismiss control", async () => {
    const openUrl = mock(() => Promise.resolve(true));
    Linking.canOpenURL = openUrl;
    Linking.openURL = mock(() => Promise.resolve());
    const onDismiss = mock(() => Promise.resolve());

    const result = renderWithTheme(
      <AnnouncementBanner
        announcement={makeAnnouncement({
          primaryAction: {label: "Read docs", url: "https://example.com/docs"},
        })}
        onAcknowledge={() => {}}
        onDismiss={onDismiss}
        requiresAcknowledgement={false}
      />
    );

    await act(async () => {
      fireEvent.press(result.getByText("Read docs"));
    });
    expect(openUrl).toHaveBeenCalledWith("https://example.com/docs");

    await act(async () => {
      fireEvent.press(result.getByLabelText("Dismiss announcement"));
    });
    assert.strictEqual(onDismiss.mock.calls.length, 1);
  });
});
