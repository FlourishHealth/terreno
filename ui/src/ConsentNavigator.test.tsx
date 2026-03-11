import {describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import React from "react";
import {ConsentNavigator} from "./ConsentNavigator";
import {Text} from "./Text";
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

const createMockApi = (forms: ConsentFormPublic[]) => {
  const mockSubmitMutation = mock(() => Promise.resolve({data: {agreed: true, id: "response-1"}}));
  const mockUnwrap = mock(() => Promise.resolve({agreed: true, id: "response-1"}));
  mockSubmitMutation.mockReturnValue({unwrap: mockUnwrap});

  return {
    injectEndpoints: mock((_config: any) => ({
      useGetPendingConsentsQuery: mock(() => ({
        data: {data: forms},
        error: undefined,
        isLoading: false,
        refetch: mock(() => Promise.resolve()),
      })),
      useSubmitConsentResponseMutation: mock(() => [
        mockSubmitMutation,
        {error: undefined, isLoading: false},
      ]),
    })),
  };
};

const createLoadingMockApi = () => ({
  injectEndpoints: mock((_config: any) => ({
    useGetPendingConsentsQuery: mock(() => ({
      data: undefined,
      error: undefined,
      isLoading: true,
      refetch: mock(() => Promise.resolve()),
    })),
    useSubmitConsentResponseMutation: mock(() => [
      mock(() => ({unwrap: mock(() => Promise.resolve({}))})),
      {error: undefined, isLoading: false},
    ]),
  })),
});

describe("ConsentNavigator", () => {
  it("renders children when there are no pending consent forms", async () => {
    const api = createMockApi([]);
    const {getByText} = renderWithTheme(
      <ConsentNavigator api={api}>
        <Text>App Content</Text>
      </ConsentNavigator>
    );

    expect(getByText("App Content")).toBeTruthy();
  });

  it("shows ConsentFormScreen when there are pending forms", async () => {
    const form = makeForm();
    const api = createMockApi([form]);

    const {getByTestId} = renderWithTheme(
      <ConsentNavigator api={api}>
        <Text>App Content</Text>
      </ConsentNavigator>
    );

    // The agree button is rendered inside ConsentFormScreen
    expect(getByTestId("consent-form-agree-button")).toBeTruthy();
  });

  it("shows loading spinner while fetching consent forms", async () => {
    const api = createLoadingMockApi();

    const {getByTestId} = renderWithTheme(
      <ConsentNavigator api={api}>
        <Text>App Content</Text>
      </ConsentNavigator>
    );

    expect(getByTestId("consent-navigator-loading")).toBeTruthy();
  });
});
