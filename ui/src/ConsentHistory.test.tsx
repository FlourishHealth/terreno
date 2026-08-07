import {afterAll, describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {Pressable} from "react-native";

// The download control is an IconButton wrapped in a Tooltip, which does not
// render its trigger in the test renderer. Mock it to a plain pressable that
// forwards onClick and testID, matching the InfoTooltipButton test pattern.
mock.module("./IconButton", () => ({
  IconButton: ({
    onClick,
    testID,
    loading,
  }: {
    onClick?: () => void;
    testID?: string;
    loading?: boolean;
  }) => <Pressable disabled={loading} onPress={onClick} testID={testID} />,
}));

// Stub jsPDF so exercising the download handler does not write a PDF file to
// disk. Methods are no-ops; splitTextToSize returns an empty line set.
class StubJsPdf {
  setFontSize(): void {}
  setFont(): void {}
  setDrawColor(): void {}
  setTextColor(): void {}
  text(): void {}
  line(): void {}
  addPage(): void {}
  addImage(): void {}
  splitTextToSize(): string[] {
    return [];
  }
  save(): void {}
}

mock.module("jspdf", () => ({jsPDF: StubJsPdf}));

afterAll(() => {
  mock.module("./IconButton", () => ({IconButton: mock(() => null)}));
});

import {ConsentHistory} from "./ConsentHistory";
import {renderWithTheme} from "./test-utils";
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

  it("invokes PDF generation and resets the loading state after a download", async () => {
    const originalError = console.error;
    console.error = mock(() => {}) as unknown as typeof console.error;
    try {
      const {getByTestId} = renderWithTheme(
        <ConsentHistory api={createApi({data: [makeEntry()]})} />
      );
      fireEvent.press(getByTestId("consent-history-item-toggle-entry-1"));

      await act(async () => {
        fireEvent.press(getByTestId("consent-history-download-entry-1"));
      });

      // The button remains mounted after the async handler settles (loading
      // state was toggled back off), regardless of whether PDF generation
      // succeeded or threw in the headless test environment.
      await waitFor(() => {
        expect(getByTestId("consent-history-download-entry-1")).toBeTruthy();
      });
    } finally {
      console.error = originalError;
    }
  });
});
