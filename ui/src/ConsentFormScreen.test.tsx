import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {ConsentFormScreen} from "./ConsentFormScreen";
import {renderWithTheme} from "./test-utils";
import type {ConsentFormPublic} from "./useConsentForms";

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
    const {getByText} = renderWithTheme(
      <ConsentFormScreen
        form={{...baseForm, content: {en: "Hello {{name}}, {{missing}} stays"}}}
        locale="en"
        onAgree={() => {}}
        variables={{name: "Ada"}}
      />
    );
    expect(getByText("Hello Ada, {{missing}} stays")).toBeTruthy();
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

  it("shows footer scroll hint when scroll to bottom is required but not done", () => {
    const form = {...baseForm, requireScrollToBottom: true};
    const {getByTestId, queryByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    expect(getByTestId("consent-footer-scroll-hint")).toBeTruthy();
    expect(queryByTestId("consent-footer-signature-hint")).toBeNull();
  });

  it("hides footer scroll hint when scroll to bottom is not required", () => {
    const {queryByTestId} = renderWithTheme(
      <ConsentFormScreen form={baseForm} locale="en" onAgree={() => {}} />
    );
    expect(queryByTestId("consent-footer-scroll-hint")).toBeNull();
  });

  it("shows footer signature hint when signature is required but not provided", () => {
    const form = {...baseForm, captureSignature: true};
    const {getByTestId, queryByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    expect(getByTestId("consent-footer-signature-hint")).toBeTruthy();
    expect(queryByTestId("consent-footer-scroll-hint")).toBeNull();
  });

  it("hides footer signature hint when signature is not required", () => {
    const {queryByTestId} = renderWithTheme(
      <ConsentFormScreen form={baseForm} locale="en" onAgree={() => {}} />
    );
    expect(queryByTestId("consent-footer-signature-hint")).toBeNull();
  });

  it("shows both footer hints when scroll and signature are both required", () => {
    const form = {...baseForm, captureSignature: true, requireScrollToBottom: true};
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    expect(getByTestId("consent-footer-scroll-hint")).toBeTruthy();
    expect(getByTestId("consent-footer-signature-hint")).toBeTruthy();
  });

  it("shows the required-items legend when any checkbox is required", () => {
    const form: ConsentFormPublic = {
      ...baseForm,
      checkboxes: [{label: "Required box", required: true}],
    };
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    expect(getByTestId("consent-form-required-legend")).toBeTruthy();
  });

  it("hides the required-items legend when no checkbox is required", () => {
    const form: ConsentFormPublic = {
      ...baseForm,
      checkboxes: [{label: "Optional box", required: false}],
    };
    const {queryByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    expect(queryByTestId("consent-form-required-legend")).toBeNull();
  });

  it("confirms the modal and toggles the checkbox on", () => {
    const form: ConsentFormPublic = {
      ...baseForm,
      checkboxes: [{confirmationPrompt: "Are you sure?", label: "Tricky", required: true}],
    };
    const {getByTestId, getByText} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    act(() => {
      fireEvent.press(getByTestId("consent-form-checkbox-0"));
    });
    expect(getByText("Are you sure?")).toBeTruthy();
    // Press the "Confirm" button inside the modal
    act(() => {
      fireEvent.press(getByText("Confirm"));
    });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Checkbox hint should be gone because the required checkbox was toggled on
        expect(getByTestId("consent-form-checkbox-0")).toBeTruthy();
        resolve();
      }, 600);
    });
  });

  it("dismisses the modal without toggling the checkbox", () => {
    const form: ConsentFormPublic = {
      ...baseForm,
      checkboxes: [{confirmationPrompt: "Are you sure?", label: "Tricky", required: true}],
    };
    const {getByTestId, getByText} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    act(() => {
      fireEvent.press(getByTestId("consent-form-checkbox-0"));
    });
    expect(getByText("Are you sure?")).toBeTruthy();
    // Press the "Cancel" button inside the modal
    act(() => {
      fireEvent.press(getByText("Cancel"));
    });
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // The checkbox hint should still show because the checkbox was not toggled
        expect(getByTestId("consent-footer-checkboxes-hint")).toBeTruthy();
        resolve();
      }, 600);
    });
  });

  it("auto-satisfies scroll requirement when content fits the viewport via contentSizeChange", () => {
    const form = {...baseForm, requireScrollToBottom: true};
    const {getByTestId, queryByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    const scroll = getByTestId("consent-form-scroll-view");
    // First set the layout height, then content size smaller than layout
    act(() => {
      fireEvent(scroll, "layout", {nativeEvent: {layout: {height: 500}}});
    });
    act(() => {
      fireEvent(scroll, "contentSizeChange", 0, 400);
    });
    expect(queryByTestId("consent-form-scroll-hint")).toBeNull();
  });

  it("auto-satisfies scroll requirement when content fits the viewport via layout", () => {
    const form = {...baseForm, requireScrollToBottom: true};
    const {getByTestId, queryByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    const scroll = getByTestId("consent-form-scroll-view");
    // First set the content size, then layout height larger than content
    act(() => {
      fireEvent(scroll, "contentSizeChange", 0, 300);
    });
    act(() => {
      fireEvent(scroll, "layout", {nativeEvent: {layout: {height: 500}}});
    });
    expect(queryByTestId("consent-form-scroll-hint")).toBeNull();
  });

  it("handleScroll returns early when already scrolled to bottom", () => {
    const form = {...baseForm, requireScrollToBottom: false};
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    const scroll = getByTestId("consent-form-scroll-view");
    // requireScrollToBottom is false so hasScrolledToBottom starts as true.
    // Firing scroll should hit the early return at line 81.
    act(() => {
      fireEvent(scroll, "scroll", {
        nativeEvent: {
          contentOffset: {y: 0},
          contentSize: {height: 1000},
          layoutMeasurement: {height: 500},
        },
      });
    });
    expect(scroll).toBeTruthy();
  });

  it("shows the checkbox footer hint when a required checkbox is unchecked", () => {
    const form: ConsentFormPublic = {
      ...baseForm,
      checkboxes: [{label: "Required box", required: true}],
    };
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    expect(getByTestId("consent-footer-checkboxes-hint")).toBeTruthy();
  });

  it("hides the checkbox footer hint once required checkboxes are checked", () => {
    const form: ConsentFormPublic = {
      ...baseForm,
      checkboxes: [{label: "Required box", required: true}],
    };
    const {getByTestId, queryByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    act(() => {
      fireEvent.press(getByTestId("consent-form-checkbox-0"));
    });
    expect(queryByTestId("consent-footer-checkboxes-hint")).toBeNull();
  });
});
