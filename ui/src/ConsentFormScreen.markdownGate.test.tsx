import {describe, it} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {assert} from "chai";

const {ConsentFormScreen} = await import("./ConsentFormScreen");
const {renderWithTheme} = await import("./test-utils");

const form = {
  active: true,
  agreeButtonText: "I agree",
  allowDecline: false,
  captureSignature: false,
  checkboxes: [],
  content: {en: "Consent body"},
  declineButtonText: "Decline",
  defaultLocale: "en",
  id: "consent-1",
  order: 0,
  required: true,
  requireScrollToBottom: true,
  slug: "consent",
  title: "Consent",
  type: "tos" as const,
  version: 1,
};

describe("ConsentFormScreen markdown load gate", () => {
  it("keeps scrolling required through pre-load measurements and later content growth", async () => {
    const {getByTestId, getByText} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    const scroll = getByTestId("consent-form-scroll-view");
    act(() => {
      fireEvent(scroll, "layout", {nativeEvent: {layout: {height: 500}}});
    });
    act(() => {
      fireEvent(scroll, "contentSizeChange", 0, 400);
    });
    assert.isOk(getByTestId("consent-form-scroll-hint"));

    act(() => {
      fireEvent(scroll, "layout", {nativeEvent: {layout: {height: 500}}});
      fireEvent(scroll, "scroll", {
        nativeEvent: {
          contentOffset: {y: 0},
          contentSize: {height: 100},
          layoutMeasurement: {height: 500},
        },
      });
    });
    await waitFor(() => {
      assert.isOk(getByText("Consent body"));
    });
    act(() => {
      fireEvent(scroll, "contentSizeChange", 0, 2000);
    });
    assert.isOk(getByTestId("consent-form-scroll-hint"));
  });
});
