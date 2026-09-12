import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {Linking} from "react-native";
import {AnnouncementScreen} from "./AnnouncementScreen";
import {renderWithTheme} from "./test-utils";
import type {AnnouncementPublic} from "./useAnnouncements";

const makeAnnouncement = (overrides: Partial<AnnouncementPublic> = {}): AnnouncementPublic => ({
  body: "## Update\n\nWe shipped announcements.",
  id: "announcement-1",
  priority: 1,
  requiresAcknowledgement: true,
  title: "What is new",
  version: 1,
  ...overrides,
});

describe("AnnouncementScreen", () => {
  it("gates acknowledge button while submitting", () => {
    const result = renderWithTheme(
      <AnnouncementScreen
        announcement={makeAnnouncement()}
        isSubmitting
        onAcknowledge={() => {}}
        onDismiss={() => {}}
        requiresAcknowledgement
      />
    );

    const gotItButton = result.getByTestId("announcement-screen.primary");
    expect(gotItButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("opens primary action URL when secondary button is pressed", async () => {
    const openUrl = mock(() => Promise.resolve(true));
    Linking.canOpenURL = openUrl;
    Linking.openURL = mock(() => Promise.resolve());

    const result = renderWithTheme(
      <AnnouncementScreen
        announcement={makeAnnouncement({
          primaryAction: {label: "Read docs", url: "https://example.com/docs"},
        })}
        onAcknowledge={() => {}}
        onDismiss={() => {}}
        requiresAcknowledgement
      />
    );

    await act(async () => {
      fireEvent.press(result.getByText("Read docs"));
    });

    expect(openUrl).toHaveBeenCalledWith("https://example.com/docs");
  });
});
