import {describe, it, mock} from "bun:test";
import {join} from "node:path";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import type React from "react";

const ISOLATED_RUN_ENV = "TERRENO_CONSENT_MARKDOWN_GATE_ISOLATED";
const isIsolatedRun = process.env[ISOLATED_RUN_ENV] === "true";

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

if (isIsolatedRun) {
  let markdownOnLoad: (() => void) | undefined;
  let markdownRenderCount = 0;

  mock.module("./MarkdownView", () => ({
    MarkdownView: ({children, onLoad}: {children?: React.ReactNode; onLoad?: () => void}) => {
      markdownRenderCount += 1;
      markdownOnLoad = onLoad;
      return <>{children}</>;
    },
  }));

  const [{ConsentFormScreen}, {renderWithTheme}] = await Promise.all([
    import("./ConsentFormScreen"),
    import("./test-utils"),
  ]);

  describe("ConsentFormScreen markdown load gate isolated behavior", () => {
    it("ignores layout, content-size, and scroll events until markdown loads", () => {
      const {getByTestId, queryByTestId} = renderWithTheme(
        <ConsentFormScreen form={form} locale="en" onAgree={() => {}} />
      );
      const scroll = getByTestId("consent-form-scroll-view");

      assert.equal(markdownRenderCount, 1);
      assert.isFunction(markdownOnLoad);

      act(() => {
        fireEvent(scroll, "contentSizeChange", 0, 400);
      });
      assert.isOk(getByTestId("consent-form-scroll-hint"));

      act(() => {
        fireEvent(scroll, "layout", {nativeEvent: {layout: {height: 500}}});
      });
      assert.isOk(getByTestId("consent-form-scroll-hint"));

      act(() => {
        fireEvent(scroll, "contentSizeChange", 0, 400);
      });
      assert.isOk(getByTestId("consent-form-scroll-hint"));

      act(() => {
        fireEvent(scroll, "scroll", {
          nativeEvent: {
            contentOffset: {y: 0},
            contentSize: {height: 100},
            layoutMeasurement: {height: 500},
          },
        });
      });
      assert.isOk(getByTestId("consent-form-scroll-hint"));

      act(() => {
        markdownOnLoad?.();
      });

      act(() => {
        fireEvent(scroll, "contentSizeChange", 0, 400);
      });
      assert.isNull(queryByTestId("consent-form-scroll-hint"));

      act(() => {
        fireEvent(scroll, "contentSizeChange", 0, 2000);
      });
      assert.isOk(getByTestId("consent-form-scroll-hint"));
    });
  });
} else {
  const {MarkdownView: RealMarkdownViewBefore} = await import("./MarkdownView");

  describe("ConsentFormScreen markdown load gate", () => {
    it("runs deterministic pre-load checks without leaking its MarkdownView mock", async () => {
      const child = Bun.spawn(
        [
          process.execPath,
          "test",
          "--preload",
          join(import.meta.dir, "bunSetup.ts"),
          import.meta.path,
        ],
        {
          cwd: join(import.meta.dir, ".."),
          env: {...process.env, [ISOLATED_RUN_ENV]: "true"},
          stderr: "pipe",
          stdout: "pipe",
        }
      );
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);

      assert.equal(exitCode, 0, `${stdout}\n${stderr}`);

      const {MarkdownView: RealMarkdownViewAfter} = await import("./MarkdownView");
      assert.strictEqual(RealMarkdownViewAfter, RealMarkdownViewBefore);
    });
  });
}
