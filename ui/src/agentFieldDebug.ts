/** Temporary browser-safe instrumentation for admin TextField update-depth investigation. */

export interface AgentTextFieldLogPayload {
  data: Record<string, unknown>;
  hypothesisId: string;
  location: string;
  message: string;
  seq: number;
  timestamp: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __agentTextFieldLogs: AgentTextFieldLogPayload[] | undefined;
  // eslint-disable-next-line no-var
  var __agentDumpTextFieldLogs:
    | (() => {
        count: number;
        logs: AgentTextFieldLogPayload[];
        summary: Record<string, number>;
      })
    | undefined;
}

let agentTextFieldLogSeq = 0;

const getTextFieldLogs = (): AgentTextFieldLogPayload[] => {
  globalThis.__agentTextFieldLogs = globalThis.__agentTextFieldLogs ?? [];
  return globalThis.__agentTextFieldLogs;
};

export const isAdminFieldTestId = (testID: string | undefined): boolean =>
  Boolean(testID?.startsWith("admin-field-"));

export const agentTextFieldLog = (
  message: string,
  hypothesisId: string,
  data: Record<string, unknown>
): void => {
  agentTextFieldLogSeq += 1;
  const payload: AgentTextFieldLogPayload = {
    data,
    hypothesisId,
    location: "TextField.tsx",
    message,
    seq: agentTextFieldLogSeq,
    timestamp: Date.now(),
  };
  getTextFieldLogs().push(payload);
  console.warn("[agent:TextField]", JSON.stringify(payload));
};

export const installAgentTextFieldLogDumper = (): void => {
  if (globalThis.__agentDumpTextFieldLogs) {
    return;
  }
  globalThis.__agentDumpTextFieldLogs = () => {
    const logs = getTextFieldLogs();
    const summary: Record<string, number> = {};
    for (const log of logs) {
      const key = `${log.message}`;
      summary[key] = (summary[key] ?? 0) + 1;
    }
    return {count: logs.length, logs, summary};
  };
};
