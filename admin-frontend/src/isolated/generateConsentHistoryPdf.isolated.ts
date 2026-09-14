import {beforeEach, describe, expect, it, mock} from "bun:test";
import {Platform} from "react-native";

interface JsPDFCall {
  method: string;
  args: unknown[];
}

const calls: JsPDFCall[] = [];
let imageMode: "success" | "throw" = "success";
let splitMode: "default" | "overflow" = "default";
const sharePdfFromHtml = mock(async () => undefined);
const buildConsentPdfHtml = mock(() => "<html>consent</html>");

class MockJsPDF {
  constructor(_opts?: unknown) {
    calls.push({args: [_opts], method: "ctor"});
  }
  addImage(...args: unknown[]) {
    calls.push({args, method: "addImage"});
    if (imageMode === "throw") {
      throw new Error("bad image");
    }
  }
  addPage() {
    calls.push({args: [], method: "addPage"});
  }
  line(...args: unknown[]) {
    calls.push({args, method: "line"});
  }
  save(...args: unknown[]) {
    calls.push({args, method: "save"});
  }
  setDrawColor(...args: unknown[]) {
    calls.push({args, method: "setDrawColor"});
  }
  setFont(...args: unknown[]) {
    calls.push({args, method: "setFont"});
  }
  setFontSize(...args: unknown[]) {
    calls.push({args, method: "setFontSize"});
  }
  setTextColor(...args: unknown[]) {
    calls.push({args, method: "setTextColor"});
  }
  splitTextToSize(text: string, _width: number): string[] {
    if (splitMode === "overflow") {
      return Array.from({length: 200}, (_v, i) => `overflow-line-${i}`);
    }
    return text.split("\n");
  }
  text(...args: unknown[]) {
    calls.push({args, method: "text"});
  }
}

mock.module("jspdf", () => ({jsPDF: MockJsPDF}));
mock.module("@terreno/ui", () => ({
  buildConsentPdfHtml,
  sharePdfFromHtml,
}));

Platform.OS = "web";

import {generateConsentHistoryPdf} from "../generateConsentHistoryPdf";
import type {ConsentHistoryEntry} from "../useConsentHistory";

const baseEntry = (): ConsentHistoryEntry => ({
  _id: "hist-1",
  agreed: true,
  agreedAt: "2024-01-15T12:00:00Z",
  form: {
    captureSignature: true,
    checkboxes: [{label: "Age", required: true}],
    slug: "privacy",
    title: "Privacy Policy",
    type: "legal",
    version: 2,
  },
});

describe("generateConsentHistoryPdf", () => {
  beforeEach(() => {
    calls.length = 0;
    imageMode = "success";
    splitMode = "default";
    sharePdfFromHtml.mockClear();
    Platform.OS = "web";
  });

  it("writes a populated web pdf with checkboxes, audit trail, signature, and snapshot", async () => {
    splitMode = "overflow";
    await generateConsentHistoryPdf({
      ...baseEntry(),
      checkboxValues: {"0": true, "1": false},
      contentSnapshot: "snapshot",
      formVersionSnapshot: 2,
      ipAddress: "127.0.0.1",
      locale: "en",
      signature: "data:image/png;base64,AAA",
      signedAt: "2024-01-15T12:01:00Z",
      userAgent: "Mozilla",
    });
    const methods = calls.map((c) => c.method);
    expect(methods).toContain("save");
    expect(methods).toContain("addImage");
    expect(methods).toContain("addPage");
    const textArgs = calls.filter((c) => c.method === "text").map((c) => String(c.args[0]));
    expect(textArgs).toContain("Agreed");
    expect(textArgs).toContain("en");
    expect(textArgs.some((t) => t.includes("Response ID: hist-1"))).toBe(true);
  });

  it("renders declined entries without a form and JPEG signature failures", async () => {
    imageMode = "throw";
    await generateConsentHistoryPdf({
      _id: "x",
      agreed: false,
      agreedAt: "not-a-date",
      form: null,
      signature: "data:image/jpeg;base64,BBB",
    });
    const textArgs = calls.filter((c) => c.method === "text").map((c) => String(c.args[0]));
    expect(textArgs).toContain("Declined");
    expect(textArgs).toContain("Unknown Form");
    expect(textArgs.some((t) => t.includes("could not be embedded"))).toBe(true);
  });

  it("shares HTML on native platforms", async () => {
    Platform.OS = "ios";
    await generateConsentHistoryPdf({
      ...baseEntry(),
      checkboxValues: {"0": false},
      ipAddress: "10.0.0.1",
      locale: "es",
      signedAt: "2024-02-01T00:00:00Z",
      userAgent: "UA",
    });
    expect(buildConsentPdfHtml).toHaveBeenCalled();
    expect(sharePdfFromHtml).toHaveBeenCalled();
  });
});
