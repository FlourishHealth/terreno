import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React, {useCallback, useState} from "react";
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

const createMockApi = (
  pending: PendingAnnouncementsResponse | (() => PendingAnnouncementsResponse),
  refetchOverride?: () => Promise<void>
) => {
  const getPending =
    typeof pending === "function" ? pending : (): PendingAnnouncementsResponse => pending;
  const refetch = refetchOverride ?? mock(() => Promise.resolve());
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
        data: {data: getPending()},
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
    impressionMutation,
    refetch,
  };
};

const announcementQueue: PendingAnnouncementsResponse[] = [
  {
    current: makeAnnouncement({id: "announcement-1", title: "First update"}),
    remainingCount: 1,
  },
  {
    current: makeAnnouncement({id: "announcement-2", title: "Second update"}),
    remainingCount: 0,
  },
  {current: null, remainingCount: 0},
];

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

  it("shows announcement modal when pending", async () => {
    const {api, impressionMutation} = createMockApi({
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

    await act(async () => {
      await Promise.resolve();
    });
    expect(impressionMutation).toHaveBeenCalledTimes(1);
  });

  it("refetches after acknowledge when more announcements remain", async () => {
    const {api, refetch, acknowledgeMutation} = createMockApi({
      current: makeAnnouncement({id: "announcement-1", title: "First"}),
      remainingCount: 1,
    });
    const result = renderWithTheme(
      <AnnouncementNavigator api={api}>
        <Box testID="app-content">
          <Text>App</Text>
        </Box>
      </AnnouncementNavigator>
    );

    await act(async () => {
      fireEvent.press(result.getByText("Got it"));
    });

    expect(acknowledgeMutation).toHaveBeenCalled();
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the next announcement after refetch advances the queue", async () => {
    const QueueHarness: React.FC = () => {
      const [queueIndex, setQueueIndex] = useState(0);
      const refetch = useCallback(async (): Promise<void> => {
        setQueueIndex((currentIndex) => Math.min(currentIndex + 1, announcementQueue.length - 1));
      }, []);
      const {api} = createMockApi(() => announcementQueue[queueIndex], refetch);

      return (
        <AnnouncementNavigator api={api}>
          <Box testID="app-content">
            <Text>App</Text>
          </Box>
        </AnnouncementNavigator>
      );
    };

    const result = renderWithTheme(<QueueHarness />);
    expect(result.getByText("First update")).toBeTruthy();

    await act(async () => {
      fireEvent.press(result.getByText("Got it"));
    });

    expect(result.getByText("Second update")).toBeTruthy();

    await act(async () => {
      fireEvent.press(result.getByText("Got it"));
    });

    expect(result.getByTestId("app-content")).toBeTruthy();
    expect(result.queryByTestId("announcement-screen")).toBeNull();
  });

  it("renders a loading spinner while pending announcements load", () => {
    const innerApi = {
      injectEndpoints: mock(() => ({
        useAcknowledgeAnnouncementMutation: mock(() => [
          mock(),
          {error: undefined, isLoading: false},
        ]),
        useGetAnnouncementFeedQuery: mock(() => ({
          data: undefined,
          error: undefined,
          isLoading: true,
          refetch: mock(() => Promise.resolve()),
        })),
        useGetPendingAnnouncementsQuery: mock(() => ({
          data: undefined,
          error: undefined,
          isLoading: true,
          refetch: mock(() => Promise.resolve()),
        })),
        useRecordAnnouncementImpressionMutation: mock(() => [
          mock(),
          {error: undefined, isLoading: false},
        ]),
      })),
    };
    const result = renderWithTheme(
      <AnnouncementNavigator api={{enhanceEndpoints: mock(() => innerApi)}}>
        <Box testID="app-content">
          <Text>App</Text>
        </Box>
      </AnnouncementNavigator>
    );
    expect(result.getByTestId("announcement-navigator-loading")).toBeTruthy();
  });

  it("shows retry UI for recoverable pending errors", () => {
    const refetch = mock(() => Promise.resolve());
    const innerApi = {
      injectEndpoints: mock(() => ({
        useAcknowledgeAnnouncementMutation: mock(() => [
          mock(),
          {error: undefined, isLoading: false},
        ]),
        useGetAnnouncementFeedQuery: mock(() => ({
          data: {data: []},
          error: undefined,
          isLoading: false,
          refetch,
        })),
        useGetPendingAnnouncementsQuery: mock(() => ({
          data: undefined,
          error: {status: 500},
          isLoading: false,
          refetch,
        })),
        useRecordAnnouncementImpressionMutation: mock(() => [
          mock(),
          {error: undefined, isLoading: false},
        ]),
      })),
    };
    const onError = mock(() => undefined);
    const result = renderWithTheme(
      <AnnouncementNavigator api={{enhanceEndpoints: mock(() => innerApi)}} onError={onError}>
        <Box testID="app-content">
          <Text>App</Text>
        </Box>
      </AnnouncementNavigator>
    );
    expect(result.getByTestId("announcement-navigator-error")).toBeTruthy();
    expect(onError).toHaveBeenCalled();
  });

  it("renders children when only the feed request fails", () => {
    const innerApi = {
      injectEndpoints: mock(() => ({
        useAcknowledgeAnnouncementMutation: mock(() => [
          mock(),
          {error: undefined, isLoading: false},
        ]),
        useGetAnnouncementFeedQuery: mock(() => ({
          data: undefined,
          error: {status: 500},
          isLoading: false,
          refetch: mock(() => Promise.resolve()),
        })),
        useGetPendingAnnouncementsQuery: mock(() => ({
          data: {data: {current: null, remainingCount: 0}},
          error: undefined,
          isLoading: false,
          refetch: mock(() => Promise.resolve()),
        })),
        useRecordAnnouncementImpressionMutation: mock(() => [
          mock(),
          {error: undefined, isLoading: false},
        ]),
      })),
    };
    const result = renderWithTheme(
      <AnnouncementNavigator api={{enhanceEndpoints: mock(() => innerApi)}}>
        <Box testID="app-content">
          <Text>App</Text>
        </Box>
      </AnnouncementNavigator>
    );
    expect(result.getByTestId("app-content")).toBeTruthy();
    expect(result.queryByTestId("announcement-navigator-error")).toBeNull();
  });

  it("records an impression instead of acknowledging when the API marks dismiss-only", async () => {
    const {api, impressionMutation, acknowledgeMutation} = createMockApi({
      current: makeAnnouncement({requiresAcknowledgement: false}),
      remainingCount: 0,
    });
    const result = renderWithTheme(
      <AnnouncementNavigator api={api}>
        <Box testID="app-content">
          <Text>App</Text>
        </Box>
      </AnnouncementNavigator>
    );
    await act(async () => {
      fireEvent.press(result.getByText("Dismiss"));
    });
    expect(impressionMutation).toHaveBeenCalled();
    expect(acknowledgeMutation).not.toHaveBeenCalled();
  });
});
