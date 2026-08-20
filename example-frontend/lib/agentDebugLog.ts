interface AgentDebugPayload {
  hypothesisId?: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
}

/** POST structured debug events to the example-backend ingest (dev / e2e only). */
export const agentDebugLog = (payload: AgentDebugPayload): void => {
  if (typeof fetch !== "function") {
    return;
  }
  void fetch("http://localhost:4000/__agent_debug_log", {
    body: JSON.stringify({...payload, timestamp: Date.now()}),
    headers: {"Content-Type": "application/json"},
    method: "POST",
  }).catch(() => {});
};
