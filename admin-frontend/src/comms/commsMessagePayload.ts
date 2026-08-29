export interface CommsMessageAttempt {
  at?: string;
  error?: string;
  errorClass?: string;
  errorCode?: string;
  provider?: string;
  providerMessageId?: string;
}

export interface CommsMessageRow {
  _id?: string;
  attemptCount?: number;
  attempts?: CommsMessageAttempt[];
  channel: string;
  created?: string;
  error?: string;
  errorClass?: string;
  errorCode?: string;
  id?: string;
  metadata?: Record<string, unknown>;
  payload?: unknown;
  provider: string;
  retriedById?: string;
  retriedFromId?: string;
  retryDisabledReason?: string;
  retryable?: boolean;
  retries?: CommsMessageRow[];
  status: string;
  subject?: string;
  templateId?: string;
  to: string;
  userId?: string;
}

/**
 * Reads a message row out of a dashboard response.
 *
 * Hosts differ in how they unwrap responses: the example app's Better Auth base query
 * strips `{data}` envelopes unless the body carries `more`, so detail and retry hooks
 * yield the row itself while list responses stay wrapped. Accept both shapes.
 */
export const unwrapCommsMessage = (payload: unknown): CommsMessageRow | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    return unwrapCommsMessage(record.data);
  }
  const rawId = record._id ?? record.id;
  const id = typeof rawId === "string" ? rawId : rawId != null ? String(rawId) : "";
  if (id.length === 0) {
    return undefined;
  }
  return {...record, _id: id} as CommsMessageRow;
};

export const commsMessageId = (row: CommsMessageRow): string => {
  return row._id ?? row.id ?? "";
};
