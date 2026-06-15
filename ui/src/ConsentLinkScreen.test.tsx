// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {ConsentLinkScreen} from "./ConsentLinkScreen";
import {renderWithTheme} from "./test-utils";
import type {ConsentFormPublic} from "./useConsentForms";

const makeForm = (overrides: Partial<ConsentFormPublic> = {}): ConsentFormPublic => ({
  active: true,
  agreeButtonText: "I Agree",
  allowDecline: false,
  captureSignature: false,
  checkboxes: [],
  content: {en: "# Terms\n\nPlease read these terms."},
  declineButtonText: "Decline",
  defaultLocale: "en",
  id: "form-1",
  order: 1,
  required: true,
  requireScrollToBottom: false,
  slug: "tos",
  title: "Terms of Service",
  type: "terms",
  version: 1,
  ...overrides,
});

interface MockState {
  data?: unknown;
  error?: unknown;
  isLoading?: boolean;
}

const createMockApi = (state: MockState, submitUnwrap?: () => Promise<unknown>) => {
  const unwrap = submitUnwrap ?? mock(() => Promise.resolve({agreed: true, id: "r-1"}));
  const submitMutation = mock(() => ({unwrap}));
  const refetch = mock(() => Promise.resolve());

  const innerApi = {
    injectEndpoints: mock(() => ({
      useGetConsentLinkQuery: mock(() => ({
        data: state.data,
        error: state.error,
        isLoading: state.isLoading ?? false,
        refetch,
      })),
      useSubmitConsentViaLinkMutation: mock(() => [
        submitMutation,
        {error: undefined, isLoading: false},
      ]),
    })),
  };

  return {
    api: {enhanceEndpoints: mock(() => innerApi)},
    refetch,
    submitMutation,
  };
};

describe("ConsentLinkScreen", () => {
  it("shows invalid message when no token is provided", () => {
    const {api} = createMockApi({data: {forms: []}});
    const {getByTestId} = renderWithTheme(<ConsentLinkScreen api={api as any} token="" />);
    expect(getByTestId("consent-link-invalid")).toBeTruthy();
  });

  it("shows a spinner while loading", () => {
    const {api} = createMockApi({isLoading: true});
    const {getByTestId} = renderWithTheme(<ConsentLinkScreen api={api as any} token="abc" />);
    expect(getByTestId("consent-link-loading")).toBeTruthy();
  });

  it("shows an error message for an invalid/expired link", () => {
    const {api} = createMockApi({
      error: {data: {title: "This consent link has expired"}, status: 410},
    });
    const {getByTestId, getByText} = renderWithTheme(
      <ConsentLinkScreen api={api as any} token="abc" />
    );
    expect(getByTestId("consent-link-error")).toBeTruthy();
    expect(getByText("This consent link has expired")).toBeTruthy();
  });

  it("renders the consent form when there are pending forms", () => {
    const {api} = createMockApi({data: {context: {name: "Pat"}, forms: [makeForm()]}});
    const {getByTestId} = renderWithTheme(<ConsentLinkScreen api={api as any} token="abc" />);
    expect(getByTestId("consent-form-agree-button")).toBeTruthy();
  });

  it("handles the unwrapped data envelope shape", () => {
    const {api} = createMockApi({data: {data: {context: {}, forms: [makeForm()]}}});
    const {getByTestId} = renderWithTheme(<ConsentLinkScreen api={api as any} token="abc" />);
    expect(getByTestId("consent-form-agree-button")).toBeTruthy();
  });

  it("shows the completion state when there are no pending forms", () => {
    const onComplete = mock(() => {});
    const {api} = createMockApi({data: {forms: []}});
    const {getByTestId} = renderWithTheme(
      <ConsentLinkScreen api={api as any} onComplete={onComplete} token="abc" />
    );
    expect(getByTestId("consent-link-complete")).toBeTruthy();
    expect(onComplete).toHaveBeenCalled();
  });

  it("submits a response when the user agrees", async () => {
    const {act, fireEvent} = await import("@testing-library/react-native");
    const {api, submitMutation} = createMockApi({data: {forms: [makeForm()]}});

    const {getByTestId} = renderWithTheme(<ConsentLinkScreen api={api as any} token="abc" />);
    await act(async () => {
      fireEvent.press(getByTestId("consent-form-agree-button"));
    });
    expect(submitMutation).toHaveBeenCalled();
  });

  it("invokes onError when submission fails", async () => {
    const {act, fireEvent} = await import("@testing-library/react-native");
    const onError = mock(() => {});
    const unwrap = mock(() => Promise.reject(new Error("failed")));
    const {api} = createMockApi({data: {forms: [makeForm()]}}, unwrap);

    const {getByTestId} = renderWithTheme(
      <ConsentLinkScreen api={api as any} onError={onError} token="abc" />
    );
    await act(async () => {
      fireEvent.press(getByTestId("consent-form-agree-button"));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(onError).toHaveBeenCalled();
  });
});
