import {DateTime} from "luxon";
import type {Model} from "mongoose";
import {APIError} from "../errors";
import {logger} from "../logger";
import {Notification} from "../models/notification";
import {NotificationPreference} from "../models/notificationPreference";
import type {NotifyInput} from "../types/notification";
import type {NotificationPreferenceDocument} from "../types/notificationPreference";

export interface NotificationsCommsService {
  sendMail: (
    message: {
      html?: string;
      subject: string;
      text?: string;
      to: string;
    },
    options?: {userId?: string}
  ) => Promise<unknown>;
  sendPushToUser: (message: {body: string; title: string; userId: string}) => Promise<unknown[]>;
  sendSms: (message: {body: string; to: string}, options?: {userId?: string}) => Promise<unknown>;
}

export interface NotificationUserLookup {
  email?: string;
  phone?: string;
}

export interface NotificationServiceOptions {
  getComms?: () => NotificationsCommsService;
  retainDays?: number;
  userModel?: Model<{email?: string; phone?: string}>;
}

export interface NotificationService {
  notify: (input: NotifyInput) => Promise<string>;
  sweepExpired: () => Promise<number>;
}

const DEFAULT_PREFERENCES: Pick<NotificationPreferenceDocument, "inapp" | "mail" | "push" | "sms"> =
  {
    inapp: true,
    mail: true,
    push: true,
    sms: true,
  };

const loadPreferences = async (
  userId: string
): Promise<Pick<NotificationPreferenceDocument, "inapp" | "mail" | "push" | "sms">> => {
  const preference = await NotificationPreference.findOneOrNone({ownerId: userId});
  if (!preference) {
    return DEFAULT_PREFERENCES;
  }
  return {
    inapp: preference.inapp,
    mail: preference.mail,
    push: preference.push,
    sms: preference.sms,
  };
};

const loadUser = async (
  userModel: Model<{email?: string; phone?: string}> | undefined,
  userId: string
): Promise<NotificationUserLookup | undefined> => {
  if (!userModel) {
    return undefined;
  }
  const user = await userModel.findById(userId).select("email phone").lean();
  if (!user) {
    return undefined;
  }
  return {email: user.email, phone: user.phone};
};

const isValidReadAt = (value: unknown): value is Date | null => {
  if (value === null || value === undefined) {
    return true;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return true;
  }
  if (typeof value === "string") {
    const parsed = DateTime.fromISO(value);
    return parsed.isValid;
  }
  return false;
};

export const assertValidNotificationReadAt = (readAt: unknown): void => {
  if (!isValidReadAt(readAt)) {
    throw new APIError({status: 400, title: "readAt must be a date or null"});
  }
};

export const createNotificationService = (
  options: NotificationServiceOptions = {}
): NotificationService => {
  const retainDays = options.retainDays ?? 0;

  const sweepExpired = async (): Promise<number> => {
    if (retainDays <= 0) {
      return 0;
    }
    const cutoff = DateTime.now().minus({days: retainDays}).toJSDate();
    const stale = await Notification.find({
      created: {$lt: cutoff},
      deleted: {$ne: true},
    });
    let tombstoned = 0;
    for (const row of stale) {
      row.deleted = true;
      await row.save();
      tombstoned += 1;
    }
    return tombstoned;
  };

  const fanOutComms = async ({
    body,
    input,
    preferences,
    title,
    user,
  }: {
    body: string;
    input: NotifyInput;
    preferences: Pick<NotificationPreferenceDocument, "mail" | "push" | "sms">;
    title: string;
    user?: NotificationUserLookup;
  }): Promise<void> => {
    const getComms = options.getComms;
    if (!getComms) {
      return;
    }

    try {
      const comms = getComms();
      if (preferences.mail && user?.email) {
        await comms.sendMail(
          {
            html: `<p>${body}</p>`,
            subject: title,
            text: body,
            to: user.email,
          },
          {userId: input.userId}
        );
      }
      if (preferences.sms && user?.phone) {
        await comms.sendSms({body: `${title}: ${body}`, to: user.phone}, {userId: input.userId});
      }
      if (preferences.push) {
        await comms.sendPushToUser({
          body,
          title,
          userId: input.userId,
        });
      }
    } catch (error) {
      logger.error("[notifications] comms fan-out failed after inbox write", {
        error,
        userId: input.userId,
      });
    }
  };

  const notify = async (input: NotifyInput): Promise<string> => {
    const preferences = await loadPreferences(input.userId);
    const user = await loadUser(options.userModel, input.userId);

    let notificationId: string | undefined;
    if (preferences.inapp) {
      const row = await Notification.create({
        body: input.body,
        href: input.href,
        kind: input.kind,
        ownerId: input.userId,
        title: input.title,
      });
      notificationId = String(row._id);
    }

    await fanOutComms({
      body: input.body,
      input,
      preferences,
      title: input.title,
      user,
    });

    if (retainDays > 0) {
      await sweepExpired();
    }

    return notificationId ?? "";
  };

  return {notify, sweepExpired};
};

let notificationService: NotificationService = createNotificationService();

export const configureNotificationService = (options: NotificationServiceOptions): void => {
  notificationService = createNotificationService(options);
};

export const getNotificationService = (): NotificationService => notificationService;
