import {Badge, Box, Heading, Text} from "@terreno/ui";
import React from "react";

import {DARK_MODE_AUDIT, type DarkModeStatus} from "./darkTheme";

/**
 * Static read-out of the `@terreno/ui` dark-mode audit: which parts of the library adapt to a
 * remapped dark theme and which will not (hardcoded colors, light-surface assumptions). Pairs with
 * the live WCAG contrast report, which flags dynamic color issues for the current palette.
 */

const STATUS_BADGE: Record<
  DarkModeStatus,
  {status: "success" | "warning" | "error"; label: string}
> = {
  adapts: {label: "Adapts", status: "success"},
  breaks: {label: "Breaks", status: "error"},
  partial: {label: "Partial", status: "warning"},
};

export const DarkModeAudit: React.FC = () => {
  return (
    <Box gap={3}>
      <Heading size="sm">Dark mode audit</Heading>
      <Text color="secondaryLight" size="sm">
        How Terreno components respond to a remapped dark theme. "Breaks" items have hardcoded
        colors or assume a light surface in the library source and need a fix to fully support dark
        mode.
      </Text>
      <Box gap={2}>
        {DARK_MODE_AUDIT.map((item) => {
          const badge = STATUS_BADGE[item.status];
          return (
            <Box border="default" gap={2} key={item.area} padding={3} rounding="md">
              <Box alignItems="center" direction="row" gap={2} justifyContent="between">
                <Text bold size="sm">
                  {item.area}
                </Text>
                <Badge status={badge.status} value={badge.label} />
              </Box>
              <Text color="secondaryLight" size="sm">
                {item.detail}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
