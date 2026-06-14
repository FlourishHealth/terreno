import type {ConflictRecord, QueuedMutation} from "./offlineTypes";

export const createTestQueuedMutation = (
  overrides: Partial<QueuedMutation> & Pick<QueuedMutation, "id" | "endpointName">
): QueuedMutation => ({
  args: {},
  attemptCount: 0,
  createdAt: "2026-04-15T10:00:00.000Z",
  idempotencyKey: overrides.id,
  modelName: "Todo",
  operation: "create",
  status: "queued",
  timestamp: "2026-04-15T10:00:00.000Z",
  type: "create",
  ...overrides,
});

export const createTestConflictRecord = (
  overrides: Partial<ConflictRecord> & Pick<ConflictRecord, "id">
): ConflictRecord => ({
  createdAt: "2026-04-15T10:30:00.000Z",
  dismissed: false,
  endpointName: "patchTodosById",
  localArgs: {},
  modelName: "Todo",
  operation: "update",
  queueId: overrides.id,
  serverValue: {},
  timestamp: "2026-04-15T10:30:00.000Z",
  ...overrides,
});
