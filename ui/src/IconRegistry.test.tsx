import {render} from "@testing-library/react-native";
import {beforeEach, describe, expect, it} from "bun:test";
import type {FC} from "react";
import type React from "react";
import {View} from "react-native";

import {Button} from "./Button";
import type {CustomIconProps, IconRegistryMap} from "./Common";
import {Icon} from "./Icon";
import {IconButton} from "./IconButton";
import {IconRegistryProvider} from "./IconRegistry";
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

  it("renders a custom icon inside an IconButton", () => {
    const {queryByTestId} = renderWithIcons(
      <IconButton accessibilityLabel="star" iconName="customStar" onClick={() => {}} />
    );
    expect(queryByTestId("custom-star")).not.toBeNull();
  });
});
