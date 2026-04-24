import type {jsPDF} from "jspdf";
import {DateTime} from "luxon";

export const PAGE_WIDTH = 210;
export const MARGIN_LEFT = 20;
export const MARGIN_RIGHT = 20;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
export const PAGE_HEIGHT = 297;
export const MARGIN_BOTTOM = 20;

export const formatDate = (value: unknown): string => {
  if (!value) {
    return "";
  }
  const dt = DateTime.fromISO(String(value));
  if (!dt.isValid) {
    return String(value);
  }
  return dt.toLocaleString(DateTime.DATETIME_FULL);
};

export const ensureSpace = (doc: jsPDF, y: number, needed: number): number => {
  if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    return 20;
  }
  return y;
};
