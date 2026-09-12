import {Badge} from "@terreno/ui";
import React from "react";

const STATUS_BADGE: Record<string, "error" | "info" | "neutral" | "success" | "warning"> = {
  cancelled: "neutral",
  completed: "success",
  dead: "error",
  failed: "error",
  pending: "info",
  running: "warning",
  scheduled: "info",
};

export const JobsStatusBadge: React.FC<{status: string; testID?: string}> = ({status, testID}) => {
  return <Badge status={STATUS_BADGE[status] ?? "neutral"} testID={testID} value={status} />;
};
