import {NotificationPreference} from "../models/notificationPreference";
import type {NotificationPreferenceChannel} from "../types/notificationPreference";

export type NotificationsBeforeSendChannel = "mail" | "push" | "sms" | "verification";

export interface NotificationsBeforeSendContext {
  channel: NotificationsBeforeSendChannel;
  userId?: string;
}

export interface NotificationsBeforeSendResult {
  cancel?: boolean;
}

const PREFERENCE_FIELD_BY_CHANNEL: Partial<
  Record<NotificationsBeforeSendChannel, NotificationPreferenceChannel>
> = {
  mail: "mail",
  push: "push",
  sms: "sms",
};

/**
 * Duck-typed CommsApp `beforeSend` hook that cancels outbound delivery when the user
 * disabled that channel in NotificationPreference. Missing preference rows default to
 * all channels on. The `verification` channel is never cancelled here.
 */
export const notificationsBeforeSend = async ({
  channel,
  userId,
}: NotificationsBeforeSendContext): Promise<NotificationsBeforeSendResult | undefined> => {
  if (channel === "verification" || !userId) {
    return undefined;
  }

  const preferenceField = PREFERENCE_FIELD_BY_CHANNEL[channel];
  if (!preferenceField) {
    return undefined;
  }

  const preference = await NotificationPreference.findOneOrNone({ownerId: userId});
  if (!preference) {
    return undefined;
  }

  if (preference[preferenceField] === false) {
    return {cancel: true};
  }

  return undefined;
};
