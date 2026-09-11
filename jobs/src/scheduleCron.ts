import {APIError} from "@terreno/api";
import {CronTime} from "cron";
import {DateTime} from "luxon";

const INVALID_CRON_TITLE = "Invalid cron expression";
const INVALID_TIMEZONE_TITLE = "Invalid IANA timezone";

export const resolveScheduleTimezone = ({
  defaultTimezone,
  scheduleTimezone,
}: {
  defaultTimezone: string;
  scheduleTimezone?: string;
}): string => scheduleTimezone ?? defaultTimezone;

export const assertValidIanaTimezone = (timezone: string): void => {
  const zoneCheck = DateTime.now().setZone(timezone);
  if (!zoneCheck.isValid) {
    throw new APIError({
      detail: zoneCheck.invalidReason ?? "Timezone is not a valid IANA identifier",
      status: 400,
      title: INVALID_TIMEZONE_TITLE,
    });
  }
};

export const assertValidCronExpression = (cron: string, timezone: string): void => {
  try {
    new CronTime(cron, timezone);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new APIError({
      cause: error instanceof Error ? error : undefined,
      detail,
      status: 400,
      title: INVALID_CRON_TITLE,
    });
  }
};

export const validateScheduleDefinition = ({
  cron,
  defaultTimezone,
  scheduleTimezone,
}: {
  cron: string;
  defaultTimezone: string;
  scheduleTimezone?: string;
}): string => {
  const timezone = resolveScheduleTimezone({
    defaultTimezone,
    scheduleTimezone,
  });
  assertValidIanaTimezone(timezone);
  assertValidCronExpression(cron, timezone);
  return timezone;
};

export const computeInitialNextRunAt = (cron: string, timezone: string): Date =>
  computeNextRunAtAfter(cron, timezone, DateTime.utc().toJSDate());

export const computeNextRunAtAfter = (cron: string, timezone: string, after: Date): Date =>
  new CronTime(cron, timezone).getNextDateFrom(after, timezone).toJSDate();
