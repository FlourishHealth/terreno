import {Box, Card, Heading, Icon, Text} from "@terreno/ui";
import React from "react";

const CARD_MIN_WIDTH = 148;

export interface CommsStatCardProps {
  /** Secondary line under the value, e.g. what the value measures. */
  caption?: string;
  label: string;
  testID?: string;
  /** `alert` tints the card and its text for a failing metric. */
  tone?: "alert" | "neutral";
  value: string;
}

/**
 * One metric tile in the comms dashboard summary row.
 *
 * The alert tone uses the light error surface with error-colored text so a failing
 * metric stays legible; a saturated fill would leave dark body text unreadable.
 */
export const CommsStatCard: React.FC<CommsStatCardProps> = ({
  caption,
  label,
  testID,
  tone = "neutral",
  value,
}) => {
  const isAlert = tone === "alert";
  return (
    <Card
      border={isAlert ? "error" : "default"}
      color={isAlert ? "errorLight" : "base"}
      minWidth={CARD_MIN_WIDTH}
      padding={3}
      testID={testID}
    >
      <Box gap={1}>
        <Box alignItems="center" direction="row" gap={1}>
          {isAlert ? (
            <Icon color="error" iconName="triangle-exclamation" size="sm" type="solid" />
          ) : null}
          <Text color={isAlert ? "error" : "secondaryDark"} size="sm" truncate>
            {label}
          </Text>
        </Box>
        <Heading color={isAlert ? "error" : "primary"} size="lg">
          {value}
        </Heading>
        {caption ? (
          <Text color={isAlert ? "error" : "secondaryLight"} size="sm">
            {caption}
          </Text>
        ) : null}
      </Box>
    </Card>
  );
};
