import {beforeEach, describe, expect, it, mock} from "bun:test";
import {Platform} from "react-native";

interface JsPDFCall {
  args: unknown[];
  method: string;
}

const calls: JsPDFCall[] = [];
let imageMode: "success" | "throw" = "success";
let splitMode: "default" | "overflow" = "default";

class MockJsPDF {
  constructor(options?: unknown) {
    calls.push({args: [options], method: "ctor"});
  }

  addImage(...args: unknown[]): void {
    calls.push({args, method: "addImage"});
    if (imageMode === "throw") {
      throw new Error("bad image");
    }
  }

  addPage(): void {
    calls.push({args: [], method: "addPage"});
  }

  line(...args: unknown[]): void {
    calls.push({args, method: "line"});
  }

  save(...args: unknown[]): void {
    calls.push({args, method: "save"});
  }

  setDrawColor(...args: unknown[]): void {
    calls.push({args, method: "setDrawColor"});
  }

  setFont(...args: unknown[]): void {
    calls.push({args, method: "setFont"});
  }

  setFontSize(...args: unknown[]): void {
    calls.push({args, method: "setFontSize"});
  }

  setTextColor(...args: unknown[]): void {
    calls.push({args, method: "setTextColor"});
  }

  splitTextToSize(text: string, _width: number): string[] {
    if (splitMode === "overflow") {
      return Array.from({length: 200}, (_value, index) => `overflow-line-${index}`);
    }
    return text.split("\n");
  }

  text(...args: unknown[]): void {
    calls.push({args, method: "text"});
  }
}

mock.module("jspdf", () => ({jsPDF: MockJsPDF}));

Platform.OS = "web";

import {generateConsentHistoryPdf} from "../generateConsentHistoryPdf";

const getRenderedText = (): string[] =>
  calls.filter((call) => call.method === "text").map((call) => String(call.args[0]));

describe("generateConsentHistoryPdf", () => {
  beforeEach(() => {
    calls.length = 0;
    imageMode = "success";
    splitMode = "default";
  });

  it("renders a complete consent record with all optional fields", async () => {
    await generateConsentHistoryPdf({
      _id: "response-123",
      agreed: true,
      agreedAt: "2024-01-15T12:00:00Z",
      checkboxValues: {"0": true, "1": false},
      contentSnapshot: Array.from({length: 120}, (_value, index) => `line ${index}`).join("\n"),
      form: {
        checkboxes: [{label: "Emails"}, {label: "Analytics"}],
        slug: "privacy",
        title: "Privacy Policy",
        type: "legal",
        version: 2,
      },
      formVersionSnapshot: 2,
      ipAddress: "127.0.0.1",
      locale: "en",
      signature: "data:image/png;base64,AAA",
      signedAt: "2024-01-15T12:01:00Z",
      userAgent: "Mozilla",
    });

    const methods = calls.map((call) => call.method);
    expect(methods).toContain("ctor");
    expect(methods).toContain("save");
    expect(methods).toContain("addImage");
    expect(methods).toContain("addPage");
    expect(String(calls.find((call) => call.method === "save")?.args[0])).toMatch(
      /^consent-privacy-/
    );

    const renderedText = getRenderedText();
    expect(renderedText).toContain("[x] Emails");
    expect(renderedText).toContain("[ ] Analytics");
    expect(renderedText).toContain("127.0.0.1");
    expect(renderedText).toContain("Mozilla");
    expect(renderedText.some((value) => value.startsWith("Response ID: response-123"))).toBe(true);
  });

  it("handles missing form metadata and a declined response", async () => {
    await generateConsentHistoryPdf({
      _id: "response-456",
      agreed: false,
      checkboxValues: null,
      formVersionSnapshot: 7,
    });

    const renderedText = getRenderedText();
    expect(renderedText).toContain("Unknown Form");
    expect(renderedText).toContain("Declined");
    expect(renderedText).toContain("7");
    expect(String(calls.find((call) => call.method === "save")?.args[0])).toMatch(
      /^consent-response-/
    );
  });

  it("uses fallback labels and handles a failed signature image", async () => {
    imageMode = "throw";
    await generateConsentHistoryPdf({
      _id: "response-789",
      agreed: true,
      checkboxValues: {"3": true},
      signature: "data:image/jpeg;base64,BBB",
    });

    const renderedText = getRenderedText();
    expect(renderedText).toContain("[x] Checkbox 3");
    expect(
      renderedText.some((value) => value.includes("Signature image could not be embedded"))
    ).toBe(true);
  });

  it("adds pages while rendering overflowing content", async () => {
    splitMode = "overflow";
    await generateConsentHistoryPdf({
      _id: "response-overflow",
      agreed: true,
      checkboxValues: Object.fromEntries(
        Array.from({length: 40}, (_value, index) => [String(index), index % 2 === 0])
      ),
      contentSnapshot: "content",
      form: {slug: "terms", title: "Terms"},
      ipAddress: "10.0.0.1",
      signature: "data:image/jpeg;base64,CCC",
      signedAt: "2024-02-01T00:00:00Z",
      userAgent: "Test agent",
    });

    expect(calls.filter((call) => call.method === "addPage").length).toBeGreaterThan(0);
  });
});
