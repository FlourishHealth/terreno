import {beforeEach, describe, expect, it} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import {
  AdminProvider,
  resetAdminWidgetWarningsForTests,
  useDeprecatedCustomScreensProp,
  useFieldWidget,
  useHomeWidget,
  useScreenWidget,
} from "./AdminProvider";
import type {AdminApi, HomeWidgetComponent} from "./types";
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

  it("warns once per missing widget and for the deprecated customScreens prop", () => {
    const Probe: React.FC = () => {
      useHomeWidget("missing-home");
      useHomeWidget("missing-home");
      useScreenWidget("missing-screen");
      useFieldWidget(undefined);
      useFieldWidget("missing-field");
      useDeprecatedCustomScreensProp([{name: "legacy"}]);
      return null;
    };
    const {toJSON} = renderWithTheme(
      <AdminProvider api={{} as unknown as AdminApi} baseUrl="/admin">
        <Probe />
      </AdminProvider>
    );
    expect(toJSON()).toBeNull();
  });
});
