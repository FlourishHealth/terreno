// biome-ignore-all lint/suspicious/noExplicitAny: test harness doubles
import {beforeEach, describe, expect, it} from "bun:test";
import {resetAdminWidgetWarningsForTests} from "./AdminProvider";
import type {HomeWidgetComponent} from "./types";
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
});
