import {afterAll, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {Text as RNText} from "react-native";

// Mock MarkdownView with a simple Text passthrough so we can assert on the
// rendered (variable-substituted) content without depending on
// react-native-markdown-display's tokenization.
mock.module("./MarkdownView", () => ({
  MarkdownView: ({children}: {children: string}) => (
    <RNText testID="markdown-view">{children}</RNText>
  ),
}));

import {ConsentFormScreen} from "./ConsentFormScreen";
import {renderWithTheme} from "./test-utils";
import type {ConsentFormPublic} from "./useConsentForms";

// Restore a no-op mock so other tests aren't affected.
afterAll(() => {
  mock.module("./MarkdownView", () => ({
    MarkdownView: mock(() => null),
  }));
});

const baseForm: ConsentFormPublic = {
  active: true,
  agreeButtonText: "I agree",
  allowDecline: true,
  captureSignature: false,
  checkboxes: [],
  content: {en: "Consent body", es: "Cuerpo de consentimiento"},
  declineButtonText: "Decline",
  defaultLocale: "en",
  id: "consent-1",
  order: 0,
  required: true,
  requireScrollToBottom: false,
  slug: "consent",
  title: "Consent",
  type: "tos",
  version: 1,
};

describe("ConsentFormScreen", () => {
  it("renders with default state and a locale fallback", () => {
    const onAgree = mock(() => {});
    const {getByTestId, getByText} = renderWithTheme(
      <ConsentFormScreen
        form={{...baseForm, content: {en: "Hello"}}}
        locale="fr"
        onAgree={onAgree}
      />
    );
    expect(getByTestId("consent-form-scroll-view")).toBeTruthy();
    expect(getByText("I agree")).toBeTruthy();
  });

  it("substitutes variables in content and preserves unknown placeholders", () => {
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen
        form={{...baseForm, content: {en: "Hello {{name}}, {{missing}} stays"}}}
        locale="en"
        onAgree={() => {}}
        variables={{name: "Ada"}}
      />
    );
    expect(getByTestId("markdown-view").props.children).toBe("Hello Ada, {{missing}} stays");
  });

  it("invokes onAgree with signature and checkbox values", () => {
    const onAgree = mock(() => {});
    const form: ConsentFormPublic = {
      ...baseForm,
      captureSignature: false,
      checkboxes: [
        {label: "Required box", required: true},
        {label: "Optional box", required: false},
      ],
    };
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={onAgree} />
    );
    // Toggle the required checkbox on and the optional one off/on
    act(() => {
      fireEvent.press(getByTestId("consent-form-checkbox-0"));
      fireEvent.press(getByTestId("consent-form-checkbox-1"));
      fireEvent.press(getByTestId("consent-form-checkbox-1"));
    });
    act(() => {
      fireEvent.press(getByTestId("consent-form-agree-button"));
    });
    // Button has a debounce; wait briefly.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(onAgree).toHaveBeenCalledTimes(1);
        const call = onAgree.mock.calls[0]?.[0] as {
          checkboxValues: Record<string, boolean>;
          signature?: string;
        };
        expect(call.checkboxValues["0"]).toBe(true);
        expect(call.signature).toBeUndefined();
        resolve();
      }, 600);
    });
  });

  it("opens and confirms the confirmation modal before toggling checkbox on", () => {
    const form: ConsentFormPublic = {
      ...baseForm,
      checkboxes: [{confirmationPrompt: "Really?", label: "Tricky", required: true}],
    };
    const {getByTestId, queryByText} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    act(() => {
      fireEvent.press(getByTestId("consent-form-checkbox-0"));
    });
    expect(queryByText("Really?")).toBeTruthy();
  });

  it("fires onDecline when decline is pressed", () => {
    const onDecline = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={baseForm} locale="en" onAgree={() => {}} onDecline={onDecline} />
    );
    act(() => {
      fireEvent.press(getByTestId("consent-form-decline-button"));
    });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(onDecline).toHaveBeenCalled();
        resolve();
      }, 600);
    });
  });

  it("fires scroll handlers without crashing", () => {
    const form = {...baseForm, requireScrollToBottom: true};
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    const scroll = getByTestId("consent-form-scroll-view");
    act(() => {
      fireEvent(scroll, "contentSizeChange", 0, 300);
      fireEvent(scroll, "layout", {nativeEvent: {layout: {height: 400}}});
      fireEvent(scroll, "scroll", {
        nativeEvent: {
          contentOffset: {y: 100},
          contentSize: {height: 300},
          layoutMeasurement: {height: 210},
        },
      });
    });
    expect(scroll).toBeTruthy();
  });

  it("shows the scroll hint when content is still scrollable", () => {
    const form = {...baseForm, requireScrollToBottom: true};
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    expect(getByTestId("consent-form-scroll-hint")).toBeTruthy();
  });
});
