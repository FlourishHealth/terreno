/** Temporary browser-safe instrumentation for admin Todo edit update-depth investigation. */

export interface AgentLogPayload {
  data: Record<string, unknown>;
  hypothesisId: string;
  location: string;
  message: string;
  seq: number;
  timestamp: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __agentAdminUpdateDepthLogs: AgentLogPayload[] | undefined;
  // eslint-disable-next-line no-var
  var __agentDumpAdminUpdateDepthLogs:
    | (() => {
        count: number;
        logs: AgentLogPayload[];
        summary: Record<string, number>;
      })
    | undefined;
}

let agentLogSeq = 0;

const getAgentLogs = (): AgentLogPayload[] => {
  globalThis.__agentAdminUpdateDepthLogs = globalThis.__agentAdminUpdateDepthLogs ?? [];
  return globalThis.__agentAdminUpdateDepthLogs;
};

export const agentAdminLog = (
  location: string,
  hypothesisId: string,
  message: string,
  data: Record<string, unknown> = {}
): void => {
  agentLogSeq += 1;
  const payload: AgentLogPayload = {
    data,
    hypothesisId,
    location,
    message,
    seq: agentLogSeq,
    timestamp: Date.now(),
  };
  getAgentLogs().push(payload);
  console.warn(`[agent:${location}]`, JSON.stringify(payload));
};

export const summarizeAgentLogs = (logs: AgentLogPayload[]): Record<string, number> => {
  const summary: Record<string, number> = {};
  for (const log of logs) {
    const key = `${log.location}:${log.message}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
};

export const installAgentLogDumper = (): void => {
  if (globalThis.__agentDumpAdminUpdateDepthLogs) {
    return;
  }
  globalThis.__agentDumpAdminUpdateDepthLogs = () => {
    const logs = getAgentLogs();
    return {
      count: logs.length,
      logs,
      summary: summarizeAgentLogs(logs),
    };
  };
};

export const previewString = (value: unknown, max = 80): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  return value.length <= max ? value : `${value.slice(0, max)}…`;
};
