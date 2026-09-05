import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {renderWithTheme} from "../../ui/src/test-utils";

import {ConsentHistory} from "./ConsentHistory";
import type {ConsentHistoryEntry} from "./useConsentHistory";

type ConsentHistoryApi = Parameters<typeof ConsentHistory>[0]["api"];

const makeEntry = (overrides: Partial<ConsentHistoryEntry> = {}): ConsentHistoryEntry => ({
  _id: "entry-1",
  agreed: true,
  agreedAt: "2026-01-02T03:04:05.000Z",
  form: {
    captureSignature: true,
    checkboxes: [{label: "I have read the terms", required: true}],
    slug: "tos",
    title: "Terms of Service",
    type: "terms",
    version: 3,
  },
  ...overrides,
});

const createApi = (state: {
  data?: unknown;
  error?: unknown;
  isLoading?: boolean;
  refetch?: () => void;
}): ConsentHistoryApi => {
  const api = {
    enhanceEndpoints: () => ({
      injectEndpoints: () => ({
        useGetMyConsentsQuery: () => ({
          data: state.data,
          error: state.error,
          isLoading: state.isLoading ?? false,
          refetch: state.refetch ?? (() => {}),
        }),
      }),
    }),
  };
  return api as unknown as ConsentHistoryApi;
};

describe("ConsentHistory", () => {
  it("renders a spinner while loading", () => {
    const {queryByTestId} = renderWithTheme(
      <ConsentHistory api={createApi({isLoading: true})} title="History" />
    );
    expect(queryByTestId("consent-history-list")).toBeNull();
  });

  it("renders an error state with a retry button", async () => {
    const refetch = mock(() => {});
    const {getByText} = renderWithTheme(
      <ConsentHistory api={createApi({error: new Error("boom"), refetch})} />
    );
    expect(getByText("Failed to load consent history")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText("Retry"));
      // Button debounces presses.
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });

  it("renders an empty state when there are no entries", () => {
    const {getByText} = renderWithTheme(<ConsentHistory api={createApi({data: []})} />);
    expect(getByText("No consent records found.")).toBeTruthy();
  });

  it("renders each entry with its form title, type and agreed badge", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <ConsentHistory api={createApi({data: [makeEntry()]})} />
    );
    expect(getByTestId("consent-history-list")).toBeTruthy();
    expect(getByText("Terms of Service")).toBeTruthy();
    expect(getByText("terms")).toBeTruthy();
    expect(getByText("Agreed")).toBeTruthy();
  });

  it("falls back to placeholder text when the form is missing and shows declined entries", () => {
    const {getByText} = renderWithTheme(
      <ConsentHistory api={createApi({data: [makeEntry({agreed: false, form: null})]})} />
    );
    expect(getByText("Unknown Form")).toBeTruthy();
    expect(getByText("Declined")).toBeTruthy();
  });

  it("expands and collapses the entry details when pressed", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <ConsentHistory api={createApi({data: [makeEntry()]})} />
    );
    expect(queryByTestId("consent-history-item-details-entry-1")).toBeNull();
    fireEvent.press(getByTestId("consent-history-item-toggle-entry-1"));
    expect(getByTestId("consent-history-item-details-entry-1")).toBeTruthy();
    fireEvent.press(getByTestId("consent-history-item-toggle-entry-1"));
    expect(queryByTestId("consent-history-item-details-entry-1")).toBeNull();
  });

  it("shows every optional detail when expanded", () => {
    const entry = makeEntry({
      checkboxValues: {"0": true, "1": false},
      contentSnapshot: "# Snapshot",
      ipAddress: "10.0.0.1",
      locale: "en-US",
      signature: "data:image/png;base64,abc",
      signedAt: "2026-01-02T03:05:00.000Z",
    });
    const {getByTestId, getByText} = renderWithTheme(
      <ConsentHistory api={createApi({data: [entry]})} />
    );
    fireEvent.press(getByTestId("consent-history-item-toggle-entry-1"));

    expect(getByText("Version:")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
    expect(getByText("Locale:")).toBeTruthy();
    expect(getByText("en-US")).toBeTruthy();
    expect(getByText("Signed:")).toBeTruthy();
    expect(getByText("IP Address:")).toBeTruthy();
    expect(getByText("10.0.0.1")).toBeTruthy();
    expect(getByText("Checkboxes")).toBeTruthy();
    // Labelled from the form for index 0, generic fallback for index 1.
    expect(getByText("I have read the terms")).toBeTruthy();
    expect(getByText("Checkbox 1")).toBeTruthy();
    expect(getByText("Yes")).toBeTruthy();
    expect(getByText("No")).toBeTruthy();
    expect(getByTestId("consent-history-signature-entry-1")).toBeTruthy();
    expect(getByText("Form Content")).toBeTruthy();
  });

  it("renders raw date values that cannot be parsed and skips empty ones", () => {
    const {getByTestId, getByText, queryByText} = renderWithTheme(
      <ConsentHistory
        api={createApi({data: [makeEntry({agreedAt: "not-a-date", signedAt: undefined})]})}
      />
    );
    expect(getByText("not-a-date")).toBeTruthy();
    fireEvent.press(getByTestId("consent-history-item-toggle-entry-1"));
    expect(queryByText("Signed:")).toBeNull();
  });

  it("renders nothing for a blank date", () => {
    const {getByTestId} = renderWithTheme(
      <ConsentHistory api={createApi({data: [makeEntry({agreedAt: ""})]})} />
    );
    expect(getByTestId("consent-history-item-entry-1")).toBeTruthy();
  });

  it("unwraps a paginated response body", () => {
    const {getByTestId} = renderWithTheme(
      <ConsentHistory api={createApi({data: {data: [makeEntry()]}})} />
    );
    expect(getByTestId("consent-history-item-entry-1")).toBeTruthy();
  });
});
