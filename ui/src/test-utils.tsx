import {mock} from "bun:test";
import {render} from "@testing-library/react-native";
import type React from "react";

import {ThemeProvider} from "./Theme";

export const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
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
