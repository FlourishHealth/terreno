// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {AdminFilterDrawer} from "./AdminFilterDrawer";

let mockWindowWidth = 1200;

mock.module("react-native", () => ({
  Dimensions: {get: () => ({height: 800, width: mockWindowWidth})},
  Platform: {OS: "web", select: (o: Record<string, unknown>) => o.web ?? o.default},
  Pressable: "Pressable",
  StyleSheet: {create: (s: unknown) => s, flatten: (s: unknown) => s},
  useWindowDimensions: () => ({height: 800, width: mockWindowWidth}),
}));

describe("AdminFilterDrawer", () => {
  beforeEach(() => {
    mockWindowWidth = 1200;
  });

  it("renders desktop drawer with apply button and filter testIDs", async () => {
    const onApply = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <AdminFilterDrawer
        api={{} as never}
        appliedFilterState={{active: undefined}}
        fields={{active: {required: false, type: "boolean"}}}
        filters={[{field: "active", kind: "boolean", label: "Active"}]}
        onApply={onApply}
      />
    );

    expect(getByTestId("admin-filter-drawer")).toBeDefined();
    expect(getByTestId("admin-filter-active")).toBeDefined();
    expect(getByTestId("admin-filter-apply")).toBeDefined();
    expect(getByTestId("admin-filter-clear-all")).toBeDefined();
    expect(getByTestId("admin-filter-apply").props.accessibilityState.disabled).toBe(true);
    expect(getByTestId("admin-filter-clear-all").props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      fireEvent.press(getByTestId("admin-filter-apply"));
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("enables apply after a draft change and clear-all applies empty filters", async () => {
    const onApply = mock(() => {});
    const {getByTestId, rerender} = renderWithTheme(
      <AdminFilterDrawer
        api={{} as never}
        appliedFilterState={{}}
        fields={{active: {required: false, type: "boolean"}}}
        filters={[{field: "active", kind: "boolean", label: "Active"}]}
        onApply={onApply}
      />
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-filter-active.switch"));
    });
    expect(getByTestId("admin-filter-apply").props.accessibilityState.disabled).toBe(false);
    expect(getByTestId("admin-filter-clear-all").props.accessibilityState.disabled).toBe(false);

    await act(async () => {
      fireEvent.press(getByTestId("admin-filter-apply"));
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]).toEqual({active: true});

    rerender(
      <AdminFilterDrawer
        api={{} as never}
        appliedFilterState={{active: true}}
        fields={{active: {required: false, type: "boolean"}}}
        filters={[{field: "active", kind: "boolean", label: "Active"}]}
        onApply={onApply}
      />
    );
    expect(getByTestId("admin-filter-apply").props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      fireEvent.press(getByTestId("admin-filter-clear-all"));
    });
    expect(onApply).toHaveBeenCalledTimes(2);
    expect(onApply.mock.calls[1]?.[0]).toEqual({});
  });
});
