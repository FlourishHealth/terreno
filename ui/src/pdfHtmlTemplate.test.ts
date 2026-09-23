import {describe, expect, it, mock} from "bun:test";
import {Platform} from "react-native";

import {buildConsentPdfHtml, type PdfTemplateData, sharePdfFromHtml} from "./pdfHtmlTemplate";

const printToFileAsync = mock(() => Promise.resolve({uri: "file:///tmp/consent.pdf"}));
const shareAsync = mock(() => Promise.resolve());

mock.module("expo-print", () => ({printToFileAsync}));
mock.module("expo-sharing", () => ({shareAsync}));

const baseData: PdfTemplateData = {
  fields: [
    {label: "Full Name", value: "Jane <Doe>"},
    {label: "Notes", value: 'Says "hi" & bye'},
  ],
  formTitle: "Consent & Release",
  title: "Consent Record",
};

describe("buildConsentPdfHtml", () => {
  it("renders the required sections and escapes HTML", () => {
    const html = buildConsentPdfHtml(baseData);

    expect(html).toStartWith("<!DOCTYPE html>");
    expect(html).toContain("<h1>Consent Record</h1>");
    expect(html).toContain('<div class="form-title">Consent &amp; Release</div>');
    expect(html).toContain('<td class="field-value">Jane &lt;Doe&gt;</td>');
    expect(html).toContain('<td class="field-value">Says &quot;hi&quot; &amp; bye</td>');
    expect(html).toContain("<h2>Response Details</h2>");
    expect(html).toMatch(/<span>Generated .+<\/span>/);

    expect(html).not.toContain("<h2>User Information</h2>");
    expect(html).not.toContain("<h2>Checkbox Responses</h2>");
    expect(html).not.toContain("<h2>Audit Trail</h2>");
    expect(html).not.toContain("<h2>Signature</h2>");
    expect(html).not.toContain("<h2>Content Snapshot</h2>");
    expect(html).not.toContain("Response ID:");
  });

  it("renders user info, checkboxes, audit trail, signature, snapshot and response id", () => {
    const html = buildConsentPdfHtml({
      ...baseData,
      auditTrail: [{label: "Signed At", value: "2025-01-01"}],
      checkboxes: [
        {checked: true, label: "I agree"},
        {checked: false, label: "Send me <updates>"},
      ],
      contentSnapshot: "Line one <b>bold</b>",
      responseId: "resp_123",
      signature: 'data:image/png;base64,abc"def',
      userInfo: {email: "jane@example.com", name: "Jane Doe", userId: "user_1"},
    });

    expect(html).toContain("<h2>User Information</h2>");
    expect(html).toContain('<td class="field-label">User ID:</td>');
    expect(html).toContain('<td class="field-value">user_1</td>');
    expect(html).toContain('<td class="field-value">Jane Doe</td>');
    expect(html).toContain('<td class="field-value">jane@example.com</td>');

    expect(html).toContain("<h2>Checkbox Responses</h2>");
    expect(html).toContain('<div class="checkbox-row">&#9745; I agree</div>');
    expect(html).toContain('<div class="checkbox-row">&#9744; Send me &lt;updates&gt;</div>');

    expect(html).toContain("<h2>Audit Trail</h2>");
    expect(html).toContain('<td class="field-label">Signed At</td>');

    expect(html).toContain("<h2>Signature</h2>");
    expect(html).toContain(
      '<img src="data:image/png;base64,abc&quot;def" class="signature-img" />'
    );

    expect(html).toContain("<h2>Content Snapshot</h2>");
    expect(html).toContain('<div class="content-snapshot">Line one &lt;b&gt;bold&lt;/b&gt;</div>');

    expect(html).toContain("<span>Response ID: resp_123</span>");
  });

  it("omits optional user info rows that are not provided", () => {
    const html = buildConsentPdfHtml({...baseData, userInfo: {userId: "user_2"}});

    expect(html).toContain('<td class="field-value">user_2</td>');
    expect(html).not.toContain('<td class="field-label">Name:</td>');
    expect(html).not.toContain('<td class="field-label">Email:</td>');
  });

  it("treats empty checkbox and audit trail lists as absent sections", () => {
    const html = buildConsentPdfHtml({...baseData, auditTrail: [], checkboxes: []});

    expect(html).not.toContain("<h2>Checkbox Responses</h2>");
    expect(html).not.toContain("<h2>Audit Trail</h2>");
  });
});

describe("sharePdfFromHtml", () => {
  it("throws on web", async () => {
    const originalOS = Platform.OS;
    Platform.OS = "web";
    try {
      await expect(sharePdfFromHtml({filename: "consent.pdf", html: "<p>hi</p>"})).rejects.toThrow(
        "sharePdfFromHtml is only supported on mobile platforms"
      );
    } finally {
      Platform.OS = originalOS;
    }
    expect(printToFileAsync).not.toHaveBeenCalled();
  });

  it("prints to a file and shares it on native", async () => {
    await sharePdfFromHtml({filename: "consent.pdf", html: "<p>hi</p>"});

    expect(printToFileAsync).toHaveBeenCalledWith({html: "<p>hi</p>"});
    expect(shareAsync).toHaveBeenCalledWith("file:///tmp/consent.pdf", {
      dialogTitle: "consent.pdf",
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
  });
});
