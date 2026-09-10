import type {FC} from "react";

import {BooleanField} from "./BooleanField";
import {Box} from "./Box";
import {Heading} from "./Heading";
import {Text} from "./Text";

export interface NotificationPreferencesState {
  inapp: boolean;
  mail: boolean;
  push: boolean;
  sms: boolean;
}

export type NotificationPreferenceChannel = keyof NotificationPreferencesState;

export interface NotificationPreferencesProps {
  onChange: (channel: NotificationPreferenceChannel, value: boolean) => void;
  preferences: NotificationPreferencesState;
  testID?: string;
}

const CHANNEL_COPY: Record<NotificationPreferenceChannel, {description: string; title: string}> = {
  inapp: {
    description: "Show notifications inside the app inbox.",
    title: "In-app inbox",
  },
  mail: {
    description: "Send notification email when a destination address is available.",
    title: "Email",
  },
  push: {
    description: "Send push notifications to registered devices.",
    title: "Push",
  },
  sms: {
    description: "Send SMS when a phone number is available.",
    title: "SMS",
  },
};

export const NotificationPreferences: FC<NotificationPreferencesProps> = ({
  onChange,
  preferences,
  testID = "notification-preferences",
}) => {
  return (
    <Box gap={4} testID={testID}>
      <Box gap={1}>
        <Heading size="lg">Notification preferences</Heading>
        <Text color="secondaryLight">
          Choose which channels can deliver notifications from this app.
        </Text>
      </Box>
      {(Object.keys(CHANNEL_COPY) as NotificationPreferenceChannel[]).map((channel) => {
        const copy = CHANNEL_COPY[channel];
        return (
          <Box gap={1} key={channel}>
            <BooleanField
              onChange={(value) => {
                onChange(channel, value);
              }}
              testID={`${testID}-${channel}`}
              title={copy.title}
              value={preferences[channel]}
            />
            <Text color="secondaryLight" size="sm">
              {copy.description}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
