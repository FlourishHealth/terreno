import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
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

  it("calls onPrimaryAction once per press instead of opening the URL directly", async () => {
    const onPrimaryAction = mock(() => Promise.resolve());
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
        onPrimaryAction={onPrimaryAction}
        requiresAcknowledgement
      />
    );

    await act(async () => {
      fireEvent.press(result.getByText("Read docs"));
    });

    assert.strictEqual(onPrimaryAction.mock.calls.length, 1);
    assert.strictEqual(openUrl.mock.calls.length, 0);
  });

  it("does not render a primary action button when primaryAction is absent", () => {
    const result = renderWithTheme(
      <AnnouncementScreen
        announcement={makeAnnouncement()}
        onAcknowledge={() => {}}
        onDismiss={() => {}}
        requiresAcknowledgement
      />
    );

    assert.isNull(result.queryByText("Read docs"));
  });
});
