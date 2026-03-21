import {jsPDF} from "jspdf";
import {DateTime} from "luxon";

import type {ConsentHistoryEntry} from "./useConsentHistory";

const PAGE_WIDTH = 210;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const PAGE_HEIGHT = 297;
const MARGIN_BOTTOM = 20;

const formatDate = (value: unknown): string => {
  if (!value) {
    return "";
  }
  const dt = DateTime.fromISO(String(value));
  if (!dt.isValid) {
    return String(value);
  }
  return dt.toLocaleString(DateTime.DATETIME_FULL);
};

const ensureSpace = (doc: jsPDF, y: number, needed: number): number => {
  if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    return 20;
  }
  return y;
};

export const generateConsentHistoryPdf = async (entry: ConsentHistoryEntry): Promise<void> => {
  const doc = new jsPDF({format: "a4", orientation: "portrait", unit: "mm"});

  const formTitle = entry.form?.title ?? "Unknown Form";
  const formSlug = entry.form?.slug ?? "";
  const formType = entry.form?.type ?? "";
  const formVersion = entry.form?.version ?? entry.formVersionSnapshot;

  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Consent Record", MARGIN_LEFT, y);
  y += 10;

  // Form title
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(formTitle, MARGIN_LEFT, y);
  y += 10;

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 8;

  // Helper to add a labeled field
  const addField = (label: string, value: string) => {
    y = ensureSpace(doc, y, 8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(label, MARGIN_LEFT, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(value, MARGIN_LEFT + 45, y);
    y += 6;
  };

  // Response Details
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Response Details", MARGIN_LEFT, y);
  y += 8;

  if (formSlug) {
    addField("Form Slug:", formSlug);
  }
  if (formType) {
    addField("Form Type:", formType);
  }
  if (formVersion !== undefined) {
    addField("Form Version:", String(formVersion));
  }
  addField("Decision:", entry.agreed ? "Agreed" : "Declined");
  if (entry.agreedAt) {
    addField("Agreed At:", formatDate(entry.agreedAt));
  }
  if (entry.locale) {
    addField("Locale:", entry.locale);
  }

  y += 4;

  // Checkbox Values
  const checkboxEntries =
    entry.checkboxValues && typeof entry.checkboxValues === "object"
      ? Object.entries(entry.checkboxValues)
      : [];

  if (checkboxEntries.length > 0) {
    y = ensureSpace(doc, y, 12 + checkboxEntries.length * 6);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Checkbox Responses", MARGIN_LEFT, y);
    y += 8;

    for (const [index, checked] of checkboxEntries) {
      y = ensureSpace(doc, y, 6);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const label = entry.form?.checkboxes?.[Number(index)]?.label;
      const checkmark = checked ? "[x]" : "[ ]";
      doc.text(`${checkmark} ${label ?? `Checkbox ${index}`}`, MARGIN_LEFT + 4, y);
      y += 6;
    }
    y += 4;
  }

  // Audit Trail
  const hasAuditTrail = entry.ipAddress || entry.userAgent || entry.formVersionSnapshot;

  if (hasAuditTrail) {
    y = ensureSpace(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Audit Trail", MARGIN_LEFT, y);
    y += 8;

    if (entry.ipAddress) {
      addField("IP Address:", entry.ipAddress);
    }
    if (entry.userAgent) {
      addField("User Agent:", entry.userAgent);
    }
    if (entry.formVersionSnapshot !== undefined) {
      addField("Form Version:", String(entry.formVersionSnapshot));
    }
    if (entry.signedAt) {
      addField("Signed At:", formatDate(entry.signedAt));
    }
    y += 4;
  }

  // Signature
  if (entry.signature) {
    y = ensureSpace(doc, y, 50);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Signature", MARGIN_LEFT, y);
    y += 6;

    try {
      const format = entry.signature.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(entry.signature, format, MARGIN_LEFT, y, 80, 30);
      y += 34;
    } catch {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("(Signature image could not be embedded)", MARGIN_LEFT, y);
      y += 6;
    }
    y += 4;
  }

  // Content Snapshot
  if (entry.contentSnapshot) {
    y = ensureSpace(doc, y, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Content Snapshot", MARGIN_LEFT, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);

    const lines = doc.splitTextToSize(entry.contentSnapshot, CONTENT_WIDTH);
    for (const line of lines) {
      y = ensureSpace(doc, y, 5);
      doc.text(line, MARGIN_LEFT, y);
      y += 4;
    }
  }

  // Footer
  y = ensureSpace(doc, y, 20);
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated ${DateTime.now().toLocaleString(DateTime.DATETIME_FULL)}`, MARGIN_LEFT, y);
  if (entry._id) {
    doc.text(`Response ID: ${entry._id}`, PAGE_WIDTH - MARGIN_RIGHT, y, {align: "right"});
  }

  // Download
  const filename = `consent-${formSlug || "response"}-${DateTime.now().toFormat("yyyy-MM-dd")}.pdf`;
  doc.save(filename);
};
