import type {
  AdminContribution,
  AdminCustomScreen,
  AdminHomeWidgetContribution,
  AdminScriptContribution,
  ModelRouterRegistration,
  TerrenoApp,
  TerrenoPlugin,
} from "@terreno/api";
import {APIError, logger} from "@terreno/api";

import type {AdminCustomScreenConfig, AdminModelConfig, AdminScriptConfig} from "./adminApp";
import {convertLegacyModelConfig} from "./legacy";
import {type ResolvedAdminModel, resolvedModelFromAdminConfig} from "./resolvedAdminModel";
import {normalizeAdminRoutePath} from "./routePath";

const isModelRouterRegistration = (
  registration: ModelRouterRegistration | TerrenoPlugin
): registration is ModelRouterRegistration => {
  return (registration as ModelRouterRegistration).__type === "modelRouter";
};

export interface AggregatedAdminContributions {
  customScreens: AdminCustomScreenConfig[];
  models: ResolvedAdminModel[];
  scripts: AdminScriptConfig[];
  widgetIds: string[];
}

const contributionScriptToConfig = (script: AdminScriptContribution): AdminScriptConfig => ({
  args: script.args,
  description: script.description,
  name: script.name,
  runner: script.runner,
});

const contributionScreenToConfig = (screen: AdminCustomScreen): AdminCustomScreenConfig => ({
  adminAccess: screen.adminAccess,
  displayName: screen.displayName,
  group: screen.group,
  icon: screen.icon,
  name: screen.name,
});

const mergeUniqueByName = <T extends {name: string}>(existing: T[], incoming: T[]): T[] => {
  const seen = new Set(existing.map((item) => item.name));
  const merged = [...existing];
  for (const item of incoming) {
    if (seen.has(item.name)) {
      continue;
    }
    seen.add(item.name);
    merged.push(item);
  }
  return merged;
};

const mergeWidgetIds = (existing: string[], incoming: AdminHomeWidgetContribution[]): string[] => {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const widget of incoming) {
    if (seen.has(widget.id)) {
      continue;
    }
    seen.add(widget.id);
    merged.push(widget.id);
  }
  return merged;
};

const warnShadowed = (
  path: string,
  incoming: ResolvedAdminModel,
  existing: ResolvedAdminModel
): void => {
  logger.warn(
    `[admin] routePath "${path}" from ${incoming.source} (${incoming.sourceLabel}) overrides ${existing.source} (${existing.sourceLabel})`
  );
};

export const aggregateAdminContributions = ({
  legacyModels = [],
  pluginContributions = [],
  registeredModels = [],
}: {
  legacyModels?: AdminModelConfig[];
  pluginContributions?: AdminContribution[];
  registeredModels?: ResolvedAdminModel[];
}): AggregatedAdminContributions => {
  const modelsByPath = new Map<string, ResolvedAdminModel>();
  const registeredByPath = new Map<string, ResolvedAdminModel>();

  for (const legacy of legacyModels) {
    const resolved = convertLegacyModelConfig(legacy);
    modelsByPath.set(resolved.routePath, resolved);
  }

  let customScreens: AdminCustomScreenConfig[] = [];
  let scripts: AdminScriptConfig[] = [];
  let widgetIds: string[] = [];

  for (const contribution of pluginContributions) {
    if (contribution.homeWidgets) {
      widgetIds = mergeWidgetIds(widgetIds, contribution.homeWidgets);
    }
    if (contribution.customScreens) {
      customScreens = mergeUniqueByName(
        customScreens,
        contribution.customScreens.map(contributionScreenToConfig)
      );
    }
    if (contribution.scripts) {
      scripts = mergeUniqueByName(scripts, contribution.scripts.map(contributionScriptToConfig));
    }
    for (const modelContribution of contribution.models ?? []) {
      const path = normalizeAdminRoutePath(modelContribution.routePath);
      const resolved = resolvedModelFromAdminConfig({
        admin: modelContribution.admin,
        model: modelContribution.model,
        populatePaths: modelContribution.populatePaths,
        queryFilter: undefined,
        routePath: path,
        source: "plugin",
        sourceLabel: modelContribution.admin.displayName,
      });
      const existing = modelsByPath.get(path);
      if (existing) {
        warnShadowed(path, resolved, existing);
      }
      modelsByPath.set(path, resolved);
    }
  }

  for (const registered of registeredModels) {
    const path = registered.routePath;
    const existingRegistered = registeredByPath.get(path);
    if (existingRegistered) {
      throw new APIError({
        status: 500,
        title: `Duplicate admin modelRouter routePath "${path}" (${existingRegistered.sourceLabel} and ${registered.sourceLabel})`,
      });
    }
    registeredByPath.set(path, registered);
    const existing = modelsByPath.get(path);
    if (existing) {
      warnShadowed(path, registered, existing);
    }
    modelsByPath.set(path, registered);
  }

  return {
    customScreens,
    models: [...modelsByPath.values()],
    scripts,
    widgetIds,
  };
};

export const collectRegisteredAdminModels = (terrenoApp?: TerrenoApp): ResolvedAdminModel[] => {
  if (!terrenoApp) {
    return [];
  }

  const models: ResolvedAdminModel[] = [];
  for (const registration of terrenoApp.getRegistrations()) {
    if (!isModelRouterRegistration(registration) || !registration.options.admin) {
      continue;
    }
    models.push(
      resolvedModelFromAdminConfig({
        admin: registration.options.admin,
        model: registration.model,
        populatePaths: registration.options.populatePaths,
        registrationPath: registration.path,
        routePath: registration.path,
        source: "registered",
        sourceLabel: registration.model.modelName,
      })
    );
  }
  return models;
};

export const collectPluginAdminContributions = (terrenoApp?: TerrenoApp): AdminContribution[] => {
  if (!terrenoApp) {
    return [];
  }
  const contributions: AdminContribution[] = [];
  for (const plugin of terrenoApp.getPlugins()) {
    const contribution = plugin.adminContribution?.();
    if (contribution) {
      contributions.push(contribution);
    }
  }
  return contributions;
};

export const aggregateFromTerrenoApp = ({
  legacyModels = [],
  terrenoApp,
}: {
  legacyModels?: AdminModelConfig[];
  terrenoApp?: TerrenoApp;
}): AggregatedAdminContributions => {
  return aggregateAdminContributions({
    legacyModels,
    pluginContributions: collectPluginAdminContributions(terrenoApp),
    registeredModels: collectRegisteredAdminModels(terrenoApp),
  });
};
