import type {PermissionSet} from "./statements";

export const unionPermissionSets = (...sets: PermissionSet[]): PermissionSet => {
  const merged: Record<string, Set<string>> = {};

  for (const set of sets) {
    for (const [resource, actions] of Object.entries(set)) {
      if (!merged[resource]) {
        merged[resource] = new Set();
      }
      for (const action of actions) {
        merged[resource].add(action);
      }
    }
  }

  const result: PermissionSet = {};
  for (const [resource, actions] of Object.entries(merged)) {
    result[resource] = [...actions];
  }
  return result;
};

export const isPermissionSubset = (
  actorPermissions: PermissionSet,
  requestedPermissions: PermissionSet
): boolean => {
  for (const [resource, actions] of Object.entries(requestedPermissions)) {
    const actorActions = actorPermissions[resource] ?? [];
    for (const action of actions) {
      if (!actorActions.includes(action)) {
        return false;
      }
    }
  }
  return true;
};

export const diffPermissionSets = (
  before: PermissionSet,
  after: PermissionSet
): {gained: PermissionSet; lost: PermissionSet} => {
  const gained: Record<string, string[]> = {};
  const lost: Record<string, string[]> = {};

  const resources = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const resource of resources) {
    const beforeActions = new Set(before[resource] ?? []);
    const afterActions = new Set(after[resource] ?? []);

    const gainedActions = [...afterActions].filter((action) => !beforeActions.has(action));
    const lostActions = [...beforeActions].filter((action) => !afterActions.has(action));

    if (gainedActions.length > 0) {
      gained[resource] = gainedActions;
    }
    if (lostActions.length > 0) {
      lost[resource] = lostActions;
    }
  }

  return {gained, lost};
};

export const validatePermissionSet = (
  permissions: PermissionSet,
  statements: Record<string, readonly string[]>
): void => {
  for (const [resource, actions] of Object.entries(permissions)) {
    const allowedActions = statements[resource];
    if (!allowedActions) {
      throw new Error(`Unknown resource: ${resource}`);
    }
    for (const action of actions) {
      if (!allowedActions.includes(action)) {
        throw new Error(`Unknown permission: ${resource}:${action}`);
      }
    }
  }
};
