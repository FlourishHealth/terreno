import {COMMS_ADMIN_WIDGETS} from "../comms/CommsDashboardScreenWidget";
import type {
  AdminWidgetRegistry,
  FieldWidgetComponent,
  HomeWidgetComponent,
  ScreenWidgetComponent,
} from "../types";
import {AI_ADMIN_WIDGETS} from "./AIRequestsScreenWidget";
import {AI_OBSERVABILITY_WIDGETS} from "./aiObservability/shell/AiObservabilityScreenWidgets";
import {MarkdownFieldWidget, TextareaFieldWidget} from "./builtInFieldWidgets";
import {CONSENT_ADMIN_WIDGETS} from "./consentWidgets";
import {DOCUMENT_STORAGE_ADMIN_WIDGETS} from "./DocumentsScreenWidget";
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
  ...AI_ADMIN_WIDGETS,
  ...AI_OBSERVABILITY_WIDGETS,
  ...COMMS_ADMIN_WIDGETS,
  ...DOCUMENT_STORAGE_ADMIN_WIDGETS,
  "version-config": VersionConfigScreenWidget,
};

export const BUILT_IN_FIELD_WIDGETS: Record<string, FieldWidgetComponent> = {
  ...CONSENT_ADMIN_WIDGETS,
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
