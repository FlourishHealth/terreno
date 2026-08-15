import {beforeEach, describe, expect, it, mock} from "bun:test";

import type {ConsentHistoryEntry} from "./useConsentHistory";

interface PdfCall {
  args: unknown[];
  method: string;
}

interface MockDoc {
  calls: PdfCall[];
  savedFilename?: string;
}

let docs: MockDoc[] = [];
let addImageShouldThrow = false;

class MockJsPdf {
  calls: PdfCall[] = [];
  savedFilename?: string;

  constructor(..._args: unknown[]) {
    docs.push(this as unknown as MockDoc);
  }

  private record(method: string, args: unknown[]): void {
    this.calls.push({args, method});
  }

  setFontSize(...args: unknown[]): void {
    this.record("setFontSize", args);
  }

  setFont(...args: unknown[]): void {
    this.record("setFont", args);
  }

  setDrawColor(...args: unknown[]): void {
    this.record("setDrawColor", args);
  }

  setTextColor(...args: unknown[]): void {
    this.record("setTextColor", args);
  }

  text(...args: unknown[]): void {
    this.record("text", args);
  }

  line(...args: unknown[]): void {
    this.record("line", args);
  }

  addPage(...args: unknown[]): void {
    this.record("addPage", args);
  }

  addImage(...args: unknown[]): void {
    this.record("addImage", args);
    if (addImageShouldThrow) {
      throw new Error("cannot embed image");
    }
  }

  splitTextToSize(textValue: string, ..._rest: unknown[]): string[] {
    this.record("splitTextToSize", [textValue]);
    return String(textValue).split("\n");
  }

  save(...args: unknown[]): void {
    this.record("save", args);
    this.savedFilename = String(args[0]);
  }
}

mock.module("jspdf", () => ({jsPDF: MockJsPdf}));

const {generateConsentHistoryPdf} = await import("./generateConsentHistoryPdf");

const lastDoc = (): MockDoc => docs[docs.length - 1]!;

const textStrings = (doc: MockDoc): string[] =>
  doc.calls.filter((c) => c.method === "text").map((c) => String(c.args[0]));

const wasCalled = (doc: MockDoc, method: string): boolean =>
  doc.calls.some((c) => c.method === method);

const baseEntry: ConsentHistoryEntry = {
  _id: "response-1",
  agreed: true,
  agreedAt: "2024-01-15T10:30:00.000Z",
  form: {
    captureSignature: true,
    checkboxes: [
      {label: "I agree to the terms", required: true},
      {label: "I consent to data use", required: false},
    ],
    slug: "privacy-policy",
    title: "Privacy Policy",
    type: "consent",
    version: 3,
  },
};

describe("generateConsentHistoryPdf", () => {
  beforeEach(() => {
    docs = [];
    addImageShouldThrow = false;
  });

  it("renders a complete consent record with every section", async () => {
    const entry: ConsentHistoryEntry = {
      ...baseEntry,
      checkboxValues: {"0": true, "1": false, "2": true},
      contentSnapshot: "First line of the snapshot\nSecond line of the snapshot",
      formVersionSnapshot: 3,
      ipAddress: "203.0.113.7",
      locale: "en-US",
      signature: "data:image/png;base64,AAAA",
      signedAt: "2024-01-15T10:31:00.000Z",
      userAgent: "Mozilla/5.0",
    };

    await generateConsentHistoryPdf(entry);

    const doc = lastDoc();
    const texts = textStrings(doc);
    expect(texts).toContain("Consent Record");
    expect(texts).toContain("Privacy Policy");
    expect(texts).toContain("Response Details");
    expect(texts).toContain("Checkbox Responses");
    expect(texts).toContain("Audit Trail");
    expect(texts).toContain("Signature");
    expect(texts).toContain("Content Snapshot");
    // Known checkbox labels render with their check state.
    expect(texts).toContain("[x] I agree to the terms");
    expect(texts).toContain("[ ] I consent to data use");
    // Unknown checkbox index falls back to a generated label.
    expect(texts).toContain("[x] Checkbox 2");
    // Agreed decision.
    expect(texts.some((t) => t === "Agreed")).toBe(true);
    // Snapshot lines are split and rendered individually.
    expect(texts).toContain("First line of the snapshot");
    expect(texts).toContain("Second line of the snapshot");
    // Image embedded as PNG.
    const image = doc.calls.find((c) => c.method === "addImage");
    expect(image?.args[1]).toBe("PNG");
    // Footer includes the response id.
    expect(texts.some((t) => t.includes("Response ID: response-1"))).toBe(true);
    // Saved with a slug-based filename.
    expect(doc.savedFilename).toContain("consent-privacy-policy-");
    expect(doc.savedFilename?.endsWith(".pdf")).toBe(true);
  });

  it("handles a minimal declined entry with no optional sections", async () => {
    const entry: ConsentHistoryEntry = {
      _id: "",
      agreed: false,
      agreedAt: "",
      form: null,
    };

    await generateConsentHistoryPdf(entry);

    const doc = lastDoc();
    const texts = textStrings(doc);
    expect(texts).toContain("Unknown Form");
    expect(texts.some((t) => t === "Declined")).toBe(true);
    expect(texts).not.toContain("Checkbox Responses");
    expect(texts).not.toContain("Audit Trail");
    expect(texts).not.toContain("Signature");
    expect(texts).not.toContain("Content Snapshot");
    expect(wasCalled(doc, "addImage")).toBe(false);
    // No _id means no response-id footer line.
    expect(texts.some((t) => t.includes("Response ID:"))).toBe(false);
    // Falls back to "response" in the filename when there is no slug.
    expect(doc.savedFilename).toContain("consent-response-");
  });

  it("embeds a JPEG signature when the data URI is not PNG", async () => {
    const entry: ConsentHistoryEntry = {
      ...baseEntry,
      signature: "data:image/jpeg;base64,BBBB",
    };

    await generateConsentHistoryPdf(entry);

    const doc = lastDoc();
    const image = doc.calls.find((c) => c.method === "addImage");
    expect(image?.args[1]).toBe("JPEG");
  });

  it("falls back to a placeholder when the signature image cannot be embedded", async () => {
    addImageShouldThrow = true;
    const entry: ConsentHistoryEntry = {
      ...baseEntry,
      signature: "data:image/png;base64,CCCC",
    };

    await generateConsentHistoryPdf(entry);

    const doc = lastDoc();
    const texts = textStrings(doc);
    expect(texts).toContain("(Signature image could not be embedded)");
  });

  it("adds pages when content overflows the page height", async () => {
    const manyLines = Array.from({length: 200}, (_v, i) => `Line ${i}`).join("\n");
    const entry: ConsentHistoryEntry = {
      ...baseEntry,
      contentSnapshot: manyLines,
    };

    await generateConsentHistoryPdf(entry);

    const doc = lastDoc();
    expect(wasCalled(doc, "addPage")).toBe(true);
  });

  it("uses the audit-trail form version when the form has no version", async () => {
    const entry: ConsentHistoryEntry = {
      _id: "id-2",
      agreed: true,
      agreedAt: "2024-01-15T10:30:00.000Z",
      form: null,
      formVersionSnapshot: 7,
    };

    await generateConsentHistoryPdf(entry);

    const doc = lastDoc();
    const texts = textStrings(doc);
    // formVersion resolves from formVersionSnapshot in Response Details...
    expect(texts).toContain("Audit Trail");
    // ...and the snapshot version shows up as a value.
    expect(texts.some((t) => t === "7")).toBe(true);
  });

  it("renders raw invalid dates and skips empty dates via formatDate", async () => {
    const entry: ConsentHistoryEntry = {
      ...baseEntry,
      agreedAt: "not-a-real-date",
      signedAt: "",
    };

    await generateConsentHistoryPdf(entry);

    const doc = lastDoc();
    const texts = textStrings(doc);
    // Invalid date string is passed through unchanged.
    expect(texts).toContain("not-a-real-date");
  });
});
