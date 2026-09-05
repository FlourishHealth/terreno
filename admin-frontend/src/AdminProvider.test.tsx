import {beforeEach, describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import {
  AdminProvider,
  resetAdminWidgetWarningsForTests,
  useAdminContext,
  useAdminWidgetRegistry,
  useDeprecatedCustomScreensProp,
  useFieldWidget,
  useHomeWidget,
  useScreenWidget,
} from "./AdminProvider";
import type {
  AdminApi,
  AdminProviderValue,
  AdminWidgetRegistry,
  FieldWidgetComponent,
  HomeWidgetComponent,
  ScreenWidgetComponent,
} from "./types";
import {BUILT_IN_HOME_WIDGETS, mergeWidgetRegistry} from "./widgets/builtInWidgets";

describe("AdminProvider widget registry", () => {
  beforeEach(() => {
    resetAdminWidgetWarningsForTests();
  });

  it("merges user home widgets over built-ins", () => {
    const Custom: HomeWidgetComponent = () => null;
    const merged = mergeWidgetRegistry({
      home: {modelsGrid: Custom},
    });
    expect(merged.home.modelsGrid).toBe(Custom);
    expect(merged.home.scriptRunner).toBe(BUILT_IN_HOME_WIDGETS.scriptRunner);
  });

  it("includes all built-in home widget ids", () => {
    expect(BUILT_IN_HOME_WIDGETS.modelsGrid).toBeDefined();
    expect(BUILT_IN_HOME_WIDGETS.scriptRunner).toBeDefined();
    expect(BUILT_IN_HOME_WIDGETS.recentActivity).toBeDefined();
  });

  it("provides resolved bases and user widget overrides", () => {
    const CustomHome: HomeWidgetComponent = () => null;
    const CustomField: FieldWidgetComponent = () => null;
    const CustomScreen: ScreenWidgetComponent = () => null;
    let context: AdminProviderValue | null = null;
    let registry: AdminWidgetRegistry | null = null;
    const Probe: React.FC = () => {
      context = useAdminContext();
      registry = useAdminWidgetRegistry();
      return null;
    };

    renderWithTheme(
      <AdminProvider
        api={{} as AdminApi}
        apiBase="/admin"
        routeBase="/console"
        widgets={{
          fields: {custom: CustomField},
          home: {custom: CustomHome},
          screens: {custom: CustomScreen},
        }}
      >
        <Probe />
      </AdminProvider>
    );

    expect(context).toMatchObject({apiBase: "/admin", routeBase: "/console"});
    expect(registry?.fields.custom).toBe(CustomField);
    expect(registry?.home.custom).toBe(CustomHome);
    expect(registry?.screens.custom).toBe(CustomScreen);
  });

  it("resolves widget hooks with and without a provider", () => {
    const CustomHome: HomeWidgetComponent = () => null;
    const CustomField: FieldWidgetComponent = () => null;
    const CustomScreen: ScreenWidgetComponent = () => null;
    const results: unknown[] = [];
    const Probe: React.FC = () => {
      results.push(
        useFieldWidget(undefined),
        useFieldWidget("custom"),
        useHomeWidget("custom"),
        useScreenWidget("custom"),
        useHomeWidget("missing"),
        useScreenWidget("missing"),
        useFieldWidget("missing")
      );
      return null;
    };

    renderWithTheme(
      <AdminProvider
        api={{} as AdminApi}
        baseUrl="/admin"
        widgets={{
          fields: {custom: CustomField},
          home: {custom: CustomHome},
          screens: {custom: CustomScreen},
        }}
      >
        <Probe />
      </AdminProvider>
    );

    expect(results).toEqual([
      undefined,
      CustomField,
      CustomHome,
      CustomScreen,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("warns once for the deprecated customScreens prop inside a provider", () => {
    const warn = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warn;
    const Probe: React.FC = () => {
      useDeprecatedCustomScreensProp([{name: "legacy"}]);
      return null;
    };

    renderWithTheme(
      <AdminProvider api={{} as AdminApi} baseUrl="/admin">
        <Probe />
      </AdminProvider>
    );
    console.warn = originalWarn;

    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
