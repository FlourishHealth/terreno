import {APIError} from "@terreno/api";
import {DateTime} from "luxon";
import mongoose from "mongoose";

export interface CommsListFilters {
  channel?: string;
  endDate?: string;
  errorClass?: string;
  errorCode?: string;
  provider?: string;
  q?: string;
  retriedFromId?: string;
  startDate?: string;
  status?: string;
  templateId?: string;
  to?: string;
  userId?: string;
}

export interface CommsListPagination {
  limit: number;
  page: number;
  skip: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_STATS_DAYS = 7;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const queryString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseCommsListFilters = (source: Record<string, unknown>): CommsListFilters => ({
  channel: queryString(source.channel),
  endDate: queryString(source.endDate),
  errorClass: queryString(source.errorClass),
  errorCode: queryString(source.errorCode),
  provider: queryString(source.provider),
  q: queryString(source.q),
  retriedFromId: queryString(source.retriedFromId),
  startDate: queryString(source.startDate),
  status: queryString(source.status),
  templateId: queryString(source.templateId),
  to: queryString(source.to),
  userId: queryString(source.userId),
});

export const parseCommsListPagination = (source: Record<string, unknown>): CommsListPagination => {
  const page = Math.max(1, Number.parseInt(String(source.page ?? ""), 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(String(source.limit ?? ""), 10) || DEFAULT_LIMIT)
  );
  return {limit, page, skip: (page - 1) * limit};
};

export const parseRetryManyLimit = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) {
    return MAX_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
};

const parseIsoDate = (value: string, field: "startDate" | "endDate"): DateTime => {
  const parsed = DateTime.fromISO(value, {zone: "utc"});
  if (!parsed.isValid) {
    throw new APIError({status: 400, title: `Invalid ${field} format`});
  }
  return parsed;
};

export const defaultStatsRange = (): {endDate: DateTime; startDate: DateTime} => {
  const endDate = DateTime.utc();
  return {endDate, startDate: endDate.minus({days: DEFAULT_STATS_DAYS})};
};

export const buildCommsMessageMatch = (
  filters: CommsListFilters,
  options?: {applyDefaultStatsRange?: boolean}
): Record<string, unknown> => {
  const match: Record<string, unknown> & {created?: {$gte?: Date; $lte?: Date}} = {
    deleted: {$ne: true},
  };

  if (filters.channel) {
    match.channel = filters.channel;
  }
  if (filters.provider) {
    match.provider = filters.provider;
  }
  if (filters.status) {
    match.status = filters.status;
  }
  if (filters.errorClass) {
    match.errorClass = filters.errorClass;
  }
  if (filters.errorCode) {
    match.errorCode = filters.errorCode;
  }
  if (filters.templateId) {
    match.templateId = filters.templateId;
  }
  if (filters.to) {
    match.to = filters.to;
  }
  if (filters.userId) {
    if (!mongoose.isValidObjectId(filters.userId)) {
      throw new APIError({status: 400, title: "Invalid userId"});
    }
    match.userId = new mongoose.Types.ObjectId(filters.userId);
  }
  if (filters.retriedFromId) {
    if (!mongoose.isValidObjectId(filters.retriedFromId)) {
      throw new APIError({status: 400, title: "Invalid retriedFromId"});
    }
    match.retriedFromId = new mongoose.Types.ObjectId(filters.retriedFromId);
  }

  let start = filters.startDate ? parseIsoDate(filters.startDate, "startDate") : undefined;
  let end = filters.endDate ? parseIsoDate(filters.endDate, "endDate") : undefined;
  if (options?.applyDefaultStatsRange && !start && !end) {
    const range = defaultStatsRange();
    start = range.startDate;
    end = range.endDate;
  }
  if (start || end) {
    match.created = {};
    if (start) {
      match.created.$gte = start.toJSDate();
    }
    if (end) {
      match.created.$lte = end.toJSDate();
    }
    if (start && end && start.toMillis() > end.toMillis()) {
      throw new APIError({status: 400, title: "startDate must not be after endDate"});
    }
  }

  if (filters.q) {
    const escaped = escapeRegex(filters.q);
    const clauses: Record<string, unknown>[] = [
      {subject: {$options: "i", $regex: escaped}},
      {error: {$options: "i", $regex: escaped}},
      {to: {$options: "i", $regex: escaped}},
    ];
    const last4 = filters.q.replace(/\s/g, "");
    if (/^[A-Za-z0-9]{4}$/.test(last4)) {
      clauses.push({to: {$options: "i", $regex: `${escapeRegex(last4)}$`}});
    }
    match.$or = clauses;
  }

  return match;
};
