import {Badge} from "@terreno/ui";
import React from "react";

const STATUS_BADGE: Record<string, "error" | "info" | "neutral" | "success" | "warning"> = {
  bounced: "warning",
  cancelled: "neutral",
  delivered: "success",
  failed: "error",
  sent: "info",
};

export const CommsStatusBadge: React.FC<{status: string; testID?: string}> = ({status, testID}) => {
  return <Badge status={STATUS_BADGE[status] ?? "neutral"} testID={testID} value={status} />;
};
