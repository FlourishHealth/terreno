import {mock} from "bun:test";
import {render} from "@testing-library/react-native";
import type React from "react";
import {View} from "react-native";

import type {CustomIconProps, IconRegistryMap} from "./Common";
import {IconRegistryProvider} from "./IconRegistry";
import {ThemeProvider} from "./Theme";

// Register a custom icon name for tests. test-utils.tsx is excluded from the
// published build (see tsconfig), so this augmentation never leaks to consumers.
declare module "./Common" {
  interface CustomIconRegistry {
    testCustomIcon: true;
  }
}

export const TEST_CUSTOM_ICON_TEST_ID = "test-custom-icon";

export const TestCustomIcon: React.FC<CustomIconProps> = ({size, testID}) => {
  return <View accessibilityLabel={`size:${size}`} testID={testID ?? TEST_CUSTOM_ICON_TEST_ID} />;
};

export const testCustomIcons: IconRegistryMap = {testCustomIcon: TestCustomIcon};

export const renderWithTheme = (ui: React.ReactElement) => {
  return render(ui, {wrapper: ThemeProvider});
};

export const renderWithIcons = (
  ui: React.ReactElement,
  icons: IconRegistryMap = testCustomIcons
) => {
  return render(ui, {
    wrapper: ({children}: {children: React.ReactNode}) => (
      <ThemeProvider>
        <IconRegistryProvider icons={icons}>{children}</IconRegistryProvider>
      </ThemeProvider>
    ),
  });
};

export const createCommonMocks = () => ({
  onBlur: mock(() => {}),
  onChange: mock(() => {}),
  onEnter: mock(() => {}),
  onFocus: mock(() => {}),
  onIconClick: mock(() => {}),
  onSubmitEditing: mock(() => {}),
});

export const setupComponentTest = () => {
  return createCommonMocks();
};

export const teardownComponentTest = () => {
  // In Bun, mocks are automatically cleaned up
  // No-op for compatibility
};
