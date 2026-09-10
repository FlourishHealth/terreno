import {createScopedLogger, logger} from "@terreno/api";
import {DateTime} from "luxon";

import type {JobsService} from "./jobsService";
import {Job} from "./models/job";
import {JobSchedule} from "./models/jobSchedule";
import type {JobScheduleDocument} from "./modelTypes";
import {IN_FLIGHT_JOB_STATUSES} from "./modelTypes";
import {computeNextRunAtAfter} from "./scheduleCron";

export const buildScheduleRunIdempotencyKey = (scheduleId: string, dueRunAt: Date): string =>
  `schedule:${scheduleId}:${dueRunAt.toISOString()}`;

const tickOneSchedule = async ({
  jobsService,
  now,
  schedule,
}: {
  jobsService: JobsService;
  now: Date;
  schedule: JobScheduleDocument;
}): Promise<void> => {
  const dueRunAt = schedule.nextRunAt;
  const advancedNextRunAt = computeNextRunAtAfter(schedule.cron, schedule.timezone, now);

  const claimed = await JobSchedule.findOneAndUpdate(
    {
      _id: schedule._id,
      enabled: true,
      nextRunAt: dueRunAt,
    },
    {
      $set: {
        nextRunAt: advancedNextRunAt,
      },
    },
    {returnDocument: "before"}
  );

  if (!claimed) {
    return;
  }

  const inFlight = await Job.findOneOrNone({
    scheduleId: claimed._id,
    status: {$in: IN_FLIGHT_JOB_STATUSES},
  });

  if (inFlight) {
    return;
  }

  const idempotencyKey = buildScheduleRunIdempotencyKey(claimed._id.toString(), claimed.nextRunAt);

  try {
    await jobsService.enqueue({
      idempotencyKey,
      name: claimed.handlerName,
      payload: {},
      runAt: claimed.nextRunAt,
      scheduleId: claimed._id.toString(),
    });
  } catch (error: unknown) {
    await JobSchedule.updateOne(
      {_id: claimed._id, nextRunAt: advancedNextRunAt},
      {$set: {nextRunAt: dueRunAt}}
    );
    throw error;
  }
};

export const tickDueSchedules = async ({
  jobsService,
  now = DateTime.utc().toJSDate(),
}: {
  defaultTimezone?: string;
  jobsService: JobsService;
  now?: Date;
}): Promise<void> => {
  const dueSchedules = await JobSchedule.find({
    enabled: true,
    nextRunAt: {$lte: now},
  }).sort({nextRunAt: 1});

  for (const schedule of dueSchedules) {
    const scheduleLog = createScopedLogger({
      labels: {scheduleName: schedule.name},
      prefix: "[JobSchedule]",
    });

    try {
      await tickOneSchedule({jobsService, now, schedule});
    } catch (error: unknown) {
      logger.error(
        `[JobSchedule] Tick failed for "${schedule.name}": ${error instanceof Error ? error.message : String(error)}`
      );
      scheduleLog.error(`Tick failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};
