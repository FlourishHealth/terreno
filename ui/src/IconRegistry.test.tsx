import {beforeEach, describe, expect, it} from "bun:test";
import {render, renderHook} from "@testing-library/react-native";
import type React from "react";
import type {FC} from "react";
import {View} from "react-native";

import {Button} from "./Button";
import type {CustomIconProps, IconRegistryMap} from "./Common";
import {Icon} from "./Icon";
import {IconButton} from "./IconButton";
import {IconRegistryProvider, useCustomIcon, useIconRegistry} from "./IconRegistry";
import {ThemeProvider} from "./Theme";

// Register a custom icon name so it type-checks anywhere an `iconName` is accepted.
declare module "./Common" {
  interface CustomIconRegistry {
    customStar: true;
  }
}

let lastProps: CustomIconProps | undefined;

const CustomStar: FC<CustomIconProps> = (props) => {
  lastProps = props;
  return <View testID="custom-star" />;
};

const ICONS: IconRegistryMap = {customStar: CustomStar};

const renderWithIcons = (ui: React.ReactElement, icons: IconRegistryMap = ICONS) => {
  return render(ui, {
    wrapper: ({children}: {children: React.ReactNode}) => (
      <ThemeProvider>
        <IconRegistryProvider icons={icons}>{children}</IconRegistryProvider>
      </ThemeProvider>
    ),
  });
};

describe("IconRegistry", () => {
  beforeEach(() => {
    lastProps = undefined;
  });

  it("renders a registered custom icon by name", () => {
    const {queryByTestId} = renderWithIcons(<Icon iconName="customStar" />);
    expect(queryByTestId("custom-star")).not.toBeNull();
  });

  it("falls back to FontAwesome for unregistered names", () => {
    const {queryByTestId} = renderWithIcons(<Icon iconName="check" />);
    expect(queryByTestId("custom-star")).toBeNull();
  });

  it("passes resolved size and a color string to the custom icon", () => {
    renderWithIcons(<Icon iconName="customStar" size="lg" />);
    expect(lastProps?.size).toBe(20);
    expect(typeof lastProps?.color).toBe("string");
  });

  it("forwards testID to the custom icon", () => {
    renderWithIcons(<Icon iconName="customStar" testID="my-icon" />);
    expect(lastProps?.testID).toBe("my-icon");
  });

  it("renders nothing custom when no icons are registered", () => {
    const {queryByTestId} = renderWithIcons(<Icon iconName="check" />, {});
    expect(queryByTestId("custom-star")).toBeNull();
  });

  it("renders a custom icon inside a Button", () => {
    const {queryByTestId} = renderWithIcons(
      <Button iconName="customStar" onClick={() => {}} text="Starred" />
    );
    expect(queryByTestId("custom-star")).not.toBeNull();
  });

  // IconButton renders `null` under the bun/react-test-renderer harness (all of
  // its existing snapshots are null), so we verify its wiring via the shared
  // `useCustomIcon` hook plus a no-throw render rather than rendered output.
  it("renders an IconButton with a custom icon without throwing", () => {
    expect(() =>
      renderWithIcons(
        <IconButton accessibilityLabel="star" iconName="customStar" onClick={() => {}} />
      )
    ).not.toThrow();
  });

  it("useIconRegistry returns the registered icon map", () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <ThemeProvider>
        <IconRegistryProvider icons={ICONS}>{children}</IconRegistryProvider>
      </ThemeProvider>
    );
    const {result} = renderHook(() => useIconRegistry(), {wrapper});
    expect(result.current).toBe(ICONS);
    expect(result.current.customStar).toBe(CustomStar);
  });

  it("useIconRegistry returns empty registry when no icons are provided", () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <ThemeProvider>
        <IconRegistryProvider>{children}</IconRegistryProvider>
      </ThemeProvider>
    );
    const {result} = renderHook(() => useIconRegistry(), {wrapper});
    expect(Object.keys(result.current)).toHaveLength(0);
  });

  it("useCustomIcon resolves registered names and ignores everything else", () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <ThemeProvider>
        <IconRegistryProvider icons={ICONS}>{children}</IconRegistryProvider>
      </ThemeProvider>
    );
    const {result: registered} = renderHook(() => useCustomIcon("customStar"), {wrapper});
    expect(registered.current).toBe(CustomStar);

    const {result: fontAwesome} = renderHook(() => useCustomIcon("check"), {wrapper});
    expect(fontAwesome.current).toBeUndefined();

    const {result: missing} = renderHook(() => useCustomIcon(undefined), {wrapper});
    expect(missing.current).toBeUndefined();
  });
});
