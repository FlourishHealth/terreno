// noExplicitAny: test mock typing
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
/**
 * Isolated because the whole `react-native` module is replaced below. `mock.module` is
 * process-wide and permanent, so running this alongside other files leaves every later
 * suite on `Platform.OS === "web"`, where `@terreno/ui` `Modal` reaches for `document`.
 */
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import {AdminFilterDrawer} from "../AdminFilterDrawer";

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

  it("renders every filter field kind and applies a boolean draft", async () => {
    const onApply = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <AdminFilterDrawer
        api={{} as never}
        appliedFilterState={{active: true, status: "open"}}
        fields={{
          active: {required: false, type: "boolean"},
          created: {required: false, type: "date"},
          query: {required: false, type: "string"},
          status: {required: false, type: "string"},
        }}
        filters={[
          {field: "active", kind: "boolean", label: "Active"},
          {field: "created", kind: "dateRange", label: "Created"},
          {
            choices: [
              {label: "Open", value: "open"},
              {label: "Closed", value: "closed"},
            ],
            field: "status",
            kind: "choice",
            label: "Status",
          },
          {field: "query", kind: "text", label: "Query"},
        ]}
        onApply={onApply}
      />
    );

    expect(getByTestId("admin-filter-created-gte")).toBeDefined();
    expect(getByTestId("admin-filter-created-lte")).toBeDefined();
    expect(getByTestId("admin-filter-query")).toBeDefined();

    await act(async () => {
      fireEvent.press(getByTestId("admin-filter-active.switch"));
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("admin-filter-created-gte"), "2024-01-01");
      fireEvent.changeText(getByTestId("admin-filter-created-lte"), "2024-01-31");
      fireEvent.changeText(getByTestId("admin-filter-query"), "needle");
      fireEvent.press(getByTestId("admin-filter-apply"));
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]).toMatchObject({
      active: false,
      status: "open",
    });
  });

  it("renders the mobile filter trigger", () => {
    mockWindowWidth = 320;
    const onApply = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <AdminFilterDrawer
        api={{} as never}
        appliedFilterState={{}}
        fields={{query: {required: false, type: "string"}}}
        filters={[{field: "query", kind: "text", label: "Query"}]}
        onApply={onApply}
      />
    );

    expect(getByTestId("admin-filter-open")).toBeDefined();
  });
});
