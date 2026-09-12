import type {AdminModelConfig} from "./types";

export const isAuditLogModel = (model: Pick<AdminModelConfig, "name" | "routePath">): boolean => {
  const path = model.routePath.toLowerCase();
  return (
    model.name === "AdminAuditLog" ||
    model.name === "AuditEvent" ||
    path.includes("audit-log") ||
    path.includes("audit-events")
  );
};
