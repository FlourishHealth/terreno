import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import type {AdminApi} from "../types";

const pushMock = mock(() => {});
mock.module("expo-router", () => ({
  router: {push: pushMock, replace: mock(() => {})},
}));

mock.module("../AdminRefField", () => ({
  AdminRefField: ({value}: {value: string}) =>
    React.createElement("Text", {testID: "comms-detail-user"}, value),
}));

interface DetailState {
  /** Either the `{data}` envelope or the row Better Auth unwraps it into. */
  data?: Record<string, unknown>;
  error?: unknown;
  isLoading: boolean;
}

const detailState: DetailState = {isLoading: false};
let retryImpl = mock(async () => ({data: {_id: "new-row"}}) as unknown);

mock.module("./useCommsDashboardApi", () => ({
  useCommsDashboardApi: () => ({
    useDetailQuery: () => detailState,
    useRetryMutation: () => [() => ({unwrap: retryImpl}), {isLoading: false}],
  }),
}));

import {CommsMessageDetail} from "./CommsMessageDetail";

describe("CommsMessageDetail", () => {
  beforeEach(() => {
    detailState.data = undefined;
    detailState.error = undefined;
    detailState.isLoading = false;
    pushMock.mockClear();
    retryImpl = mock(async () => ({data: {_id: "new-row"}}) as unknown);
  });

  it("renders loading and error states", () => {
    detailState.isLoading = true;
    const loading = renderWithTheme(<CommsMessageDetail api={{} as AdminApi} messageId="m1" />);
    expect(loading.getByTestId("comms-detail-loading")).toBeTruthy();

    detailState.isLoading = false;
    detailState.error = {status: 500};
    const errored = renderWithTheme(<CommsMessageDetail api={{} as AdminApi} messageId="m1" />);
    expect(errored.getByTestId("comms-detail-error")).toBeTruthy();
  });

  it("shows the specific non-retryable reason on the retry control", () => {
    detailState.data = {
      data: {
        _id: "m1",
        attempts: [
          {
            at: "2026-08-20T00:00:00.000Z",
            error: "invalid",
            errorCode: "550",
            provider: "sendgrid",
            providerMessageId: "sg-1",
          },
        ],
        channel: "mail",
        created: "2026-08-20T00:00:00.000Z",
        metadata: {consoleUrl: "https://sendgrid.example/activity/sg-1"},
        payload: {subject: "Hi"},
        provider: "sendgrid",
        retryable: false,
        retryDisabledReason: "Permanent failures cannot be retried",
        status: "failed",
        to: "a***@example.com",
      },
    };
    const {getByTestId} = renderWithTheme(
      <CommsMessageDetail api={{} as AdminApi} messageId="m1" />
    );
    expect(getByTestId("comms-detail-retry").props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId("comms-attempt-0")).toBeTruthy();
    expect(getByTestId("comms-detail-payload")).toBeTruthy();
  });

  it("renders an unwrapped Better Auth detail payload", () => {
    detailState.data = {
      _id: "m1",
      attempts: [{at: "2026-08-20T00:00:00.000Z", provider: "sendgrid"}],
      channel: "mail",
      provider: "sendgrid",
      retryable: true,
      status: "failed",
      to: "a***@example.com",
    };
    const {getByTestId} = renderWithTheme(
      <CommsMessageDetail api={{} as AdminApi} messageId="m1" />
    );
    expect(getByTestId("comms-detail-retry")).toBeTruthy();
    expect(getByTestId("comms-attempt-0")).toBeTruthy();
  });

  it("reports a missing message rather than an empty shell", () => {
    detailState.data = undefined;
    const {getByTestId} = renderWithTheme(
      <CommsMessageDetail api={{} as AdminApi} messageId="m1" />
    );
    expect(getByTestId("comms-detail-empty")).toBeTruthy();
  });

  it("links the retry chain, the user, and the provider console", async () => {
    detailState.data = {
      _id: "m2",
      attempts: [
        {
          at: "not-a-timestamp",
          provider: "sendgrid",
          providerMessageId: "sg-9",
        },
        {provider: "sendgrid"},
      ],
      channel: "mail",
      metadata: {consoleUrl: "https://sendgrid.example/activity/sg-9"},
      provider: "sendgrid",
      retriedById: "m3",
      retriedFromId: "m0",
      retryable: false,
      status: "bounced",
      to: "a***@example.com",
      userId: "user-1",
    };
    const {getByTestId} = renderWithTheme(
      <CommsMessageDetail api={{} as AdminApi} messageId="m2" routeBase="/admin" />
    );

    // An unparseable attempt timestamp is shown verbatim instead of crashing the timeline.
    expect(getByTestId("comms-attempt-0-console")).toBeTruthy();
    expect(getByTestId("comms-detail-user")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("comms-detail-retried-from"));
    });
    expect(String(pushMock.mock.calls.at(-1)?.[0])).toBe("/admin/comms/m0");

    await act(async () => {
      fireEvent.press(getByTestId("comms-detail-retried-by"));
    });
    expect(String(pushMock.mock.calls.at(-1)?.[0])).toBe("/admin/comms/m3");
  });

  it("surfaces a rejected retry without navigating", async () => {
    detailState.data = {
      _id: "m1",
      channel: "mail",
      provider: "sendgrid",
      retryable: true,
      status: "failed",
      to: "a***@example.com",
    };
    retryImpl = mock(async () => {
      throw {status: 400, title: "Retained payload is missing or expired"};
    });
    const {getAllByText, getByTestId} = renderWithTheme(
      <CommsMessageDetail api={{} as AdminApi} messageId="m1" />
    );
    await act(async () => {
      fireEvent.press(getByTestId("comms-detail-retry"));
    });
    await act(async () => {
      const confirms = getAllByText("Confirm");
      fireEvent.press(confirms[confirms.length - 1]);
    });
    expect(retryImpl).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("treats a retry response without a row as a failure", async () => {
    detailState.data = {
      _id: "m1",
      channel: "mail",
      provider: "sendgrid",
      retryable: true,
      status: "failed",
      to: "a***@example.com",
    };
    retryImpl = mock(async () => ({}) as unknown);
    const {getAllByText, getByTestId} = renderWithTheme(
      <CommsMessageDetail api={{} as AdminApi} messageId="m1" />
    );
    await act(async () => {
      fireEvent.press(getByTestId("comms-detail-retry"));
    });
    await act(async () => {
      const confirms = getAllByText("Confirm");
      fireEvent.press(confirms[confirms.length - 1]);
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates to the new row after a confirmed retry", async () => {
    detailState.data = {
      data: {
        _id: "m1",
        channel: "mail",
        provider: "sendgrid",
        retryable: true,
        status: "failed",
        to: "a***@example.com",
      },
    };
    const {getAllByText, getByTestId} = renderWithTheme(
      <CommsMessageDetail api={{} as AdminApi} messageId="m1" />
    );
    await act(async () => {
      fireEvent.press(getByTestId("comms-detail-retry"));
    });
    await act(async () => {
      const confirmButtons = getAllByText("Confirm");
      fireEvent.press(confirmButtons[confirmButtons.length - 1]);
    });
    expect(retryImpl).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalled();
    const href = String((pushMock.mock.calls[0] as unknown as [string])[0]);
    expect(href).toContain("/admin/comms/new-row");
  });
});
