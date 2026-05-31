import type {
  OfflineLegacyEndpointConfig,
  OfflineMiddlewareOfflineConfig,
  OfflineModelRouterConfig,
  OfflineOperation,
  ResolvedOfflineEndpoint,
} from "./offlineTypes";

const inferOperationFromEndpointName = (endpointName: string): OfflineOperation => {
  if (endpointName.startsWith("post")) {
    return "create";
  }
  if (endpointName.startsWith("patch")) {
    return "update";
  }
  if (endpointName.startsWith("delete")) {
    return "delete";
  }
  return "update";
};

const inferTagTypeFromEndpointName = (endpointName: string): string => {
  let name = endpointName.replace(/^(post|patch|delete)/, "").replace(/ById$/, "");
  name = name.charAt(0).toLowerCase() + name.slice(1);
  return name;
};

const inferModelNameFromTagType = (tagType: string): string => {
  return tagType.charAt(0).toUpperCase() + tagType.slice(1);
};

export const isModelRouterOfflineConfig = (
  config: OfflineMiddlewareOfflineConfig
): config is OfflineModelRouterConfig => {
  return "models" in config;
};

export const resolveOfflineEndpoints = (
  config: OfflineMiddlewareOfflineConfig
): ResolvedOfflineEndpoint[] => {
  if (!isModelRouterOfflineConfig(config)) {
    return config.endpoints.map((endpointName) => {
      const tagType = inferTagTypeFromEndpointName(endpointName);
      return {
        endpointName,
        modelName: inferModelNameFromTagType(tagType),
        operation: inferOperationFromEndpointName(endpointName),
        tagType,
      };
    });
  }

  if (!config.enabled) {
    return [];
  }

  const resolved: ResolvedOfflineEndpoint[] = [];

  for (const model of config.models) {
    const operations: OfflineOperation[] = [
      "create",
      "update",
      "delete",
      "arrayPush",
      "arrayUpdate",
      "arrayRemove",
    ];

    for (const operation of operations) {
      const endpointConfig = model.endpoints[operation];
      if (!endpointConfig?.endpointName) {
        continue;
      }
      if (endpointConfig.enabled === false) {
        continue;
      }

      resolved.push({
        conflictStrategy: model.conflictStrategy,
        endpointName: endpointConfig.endpointName,
        idStrategy: model.idStrategy,
        modelName: model.modelName,
        operation,
        optimisticUpdate: endpointConfig.optimisticUpdate,
        tagType: model.tagType,
      });
    }
  }

  return resolved;
};

export const getOfflineEndpointMap = (
  config: OfflineMiddlewareOfflineConfig
): Map<string, ResolvedOfflineEndpoint> => {
  const map = new Map<string, ResolvedOfflineEndpoint>();
  for (const endpoint of resolveOfflineEndpoints(config)) {
    map.set(endpoint.endpointName, endpoint);
  }
  return map;
};
