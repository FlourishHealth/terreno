import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";

let markdownOnLoad: (() => void) | undefined;

mock.module("./MarkdownView", () => ({
  MarkdownView: ({children, onLoad}: {children?: React.ReactNode; onLoad?: () => void}) => {
    markdownOnLoad = onLoad;
    return <>{children}</>;
  },
}));

const {ConsentFormScreen} = await import("./ConsentFormScreen");
const {renderWithTheme} = await import("./test-utils");

describe("ConsentFormScreen markdown load gate", () => {
  it("does not auto-satisfy scroll while markdown onLoad has not fired", () => {
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
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    const scroll = getByTestId("consent-form-scroll-view");
    act(() => {
      fireEvent(scroll, "layout", {nativeEvent: {layout: {height: 500}}});
    });
    act(() => {
      fireEvent(scroll, "contentSizeChange", 0, 400);
    });
    expect(getByTestId("consent-form-scroll-hint")).toBeTruthy();
  });

  it("ignores pre-load bottom scroll after markdown grows", () => {
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
    const {getByTestId} = renderWithTheme(
      <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
    );
    const scroll = getByTestId("consent-form-scroll-view");
    act(() => {
      fireEvent(scroll, "layout", {nativeEvent: {layout: {height: 500}}});
      fireEvent(scroll, "scroll", {
        nativeEvent: {
          contentOffset: {y: 0},
          contentSize: {height: 100},
          layoutMeasurement: {height: 500},
        },
      });
      markdownOnLoad?.();
      fireEvent(scroll, "contentSizeChange", 0, 2000);
    });
    expect(getByTestId("consent-form-scroll-hint")).toBeTruthy();
  });
});
