import type {
  AdminWidgetRegistry,
  FieldWidgetComponent,
  HomeWidgetComponent,
  ScreenWidgetComponent,
} from "../types";
import {
  CheckboxListFieldWidget,
  LocaleContentFieldWidget,
  LocaleDefaultFieldWidget,
  MarkdownFieldWidget,
  TextareaFieldWidget,
} from "./builtInFieldWidgets";
import {CustomScreensListWidget} from "./CustomScreensListWidget";
import {FeatureFlagsOverridesWidget} from "./FeatureFlagsOverridesWidget";
import {ModelsGridWidget} from "./ModelsGridWidget";
import {RecentActivityWidget} from "./RecentActivityWidget";
import {ScriptRunnerWidget} from "./ScriptRunnerWidget";
import {VersionConfigScreenWidget} from "./VersionConfigScreenWidget";
import {VersionConfigWidget} from "./VersionConfigWidget";

export const BUILT_IN_HOME_WIDGETS: Record<string, HomeWidgetComponent> = {
  "feature-flags-overrides": FeatureFlagsOverridesWidget,
  modelStats: ModelsGridWidget,
  modelsGrid: ModelsGridWidget,
  recentActivity: RecentActivityWidget,
  scriptRunner: ScriptRunnerWidget,
  versionConfig: VersionConfigWidget,
};

export const BUILT_IN_SCREEN_WIDGETS: Record<string, ScreenWidgetComponent> = {
  "version-config": VersionConfigScreenWidget,
};

export const BUILT_IN_FIELD_WIDGETS: Record<string, FieldWidgetComponent> = {
  "checkbox-list": CheckboxListFieldWidget,
  "locale-content": LocaleContentFieldWidget,
  "locale-default": LocaleDefaultFieldWidget,
  markdown: MarkdownFieldWidget,
  textarea: TextareaFieldWidget,
};

export const BUILT_IN_WIDGET_REGISTRY: AdminWidgetRegistry = {
  fields: BUILT_IN_FIELD_WIDGETS,
  home: BUILT_IN_HOME_WIDGETS,
  screens: BUILT_IN_SCREEN_WIDGETS,
};

export const mergeWidgetRegistry = (
  userWidgets?: Partial<AdminWidgetRegistry>
): AdminWidgetRegistry => ({
  fields: {...BUILT_IN_FIELD_WIDGETS, ...userWidgets?.fields},
  home: {...BUILT_IN_HOME_WIDGETS, ...userWidgets?.home},
  screens: {...BUILT_IN_SCREEN_WIDGETS, ...userWidgets?.screens},
});
