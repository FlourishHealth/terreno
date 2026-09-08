import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {Text} from "react-native";
import {AnnouncementNavigator} from "./AnnouncementNavigator";
import {Box} from "./Box";
import {renderWithTheme} from "./test-utils";
import type {AnnouncementPublic, PendingAnnouncementsResponse} from "./useAnnouncements";

const makeAnnouncement = (overrides: Partial<AnnouncementPublic> = {}): AnnouncementPublic => ({
  body: "## Update\n\nWe shipped announcements.",
  id: "announcement-1",
  priority: 1,
  requiresAcknowledgement: true,
  title: "What is new",
  version: 1,
  ...overrides,
});

const createMockApi = (pending: PendingAnnouncementsResponse) => {
  const refetch = mock(() => Promise.resolve());
  const acknowledgeMutation = mock(() => ({
    unwrap: mock(() => Promise.resolve({data: {acknowledged: true}})),
  }));
  const impressionMutation = mock(() => ({
    unwrap: mock(() => Promise.resolve({data: {recorded: true}})),
  }));

  const innerApi = {
    injectEndpoints: mock((_config: unknown) => ({
      useAcknowledgeAnnouncementMutation: mock(() => [
        acknowledgeMutation,
        {error: undefined, isLoading: false},
      ]),
      useGetAnnouncementFeedQuery: mock(() => ({
        data: {data: []},
        error: undefined,
        isLoading: false,
        refetch,
      })),
      useGetPendingAnnouncementsQuery: mock(() => ({
        data: {data: pending},
        error: undefined,
        isLoading: false,
        refetch,
      })),
      useRecordAnnouncementImpressionMutation: mock(() => [
        impressionMutation,
        {error: undefined, isLoading: false},
      ]),
    })),
  };

  return {
    acknowledgeMutation,
    api: {
      enhanceEndpoints: mock(() => innerApi),
    },
    refetch,
  };
};

describe("AnnouncementNavigator", () => {
  it("renders children when no announcements are pending", () => {
    const {api} = createMockApi({current: null, remainingCount: 0});
    const result = renderWithTheme(
      <AnnouncementNavigator api={api}>
        <Box testID="app-content">
          <Text>App</Text>
        </Box>
      </AnnouncementNavigator>
    );
    expect(result.getByTestId("app-content")).toBeTruthy();
  });

  it("shows announcement modal when pending", () => {
    const {api} = createMockApi({
      current: makeAnnouncement(),
      remainingCount: 0,
    });
    const result = renderWithTheme(
      <AnnouncementNavigator api={api}>
        <Box testID="app-content">
          <Text>App</Text>
        </Box>
      </AnnouncementNavigator>
    );
    expect(result.getByTestId("announcement-screen")).toBeTruthy();
  });
});
