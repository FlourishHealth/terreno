import "../../ui/src/bunSetup";
import {mock} from "bun:test";
import React from "react";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

interface MockUiProps {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  testID?: string;
  text?: string;
}

const createUiElement = (name: string): React.FC<MockUiProps> => {
  return ({children, ...props}): React.ReactElement => {
    return React.createElement(name, props, children);
  };
};

const uiMocks = {
  Box: createUiElement("Box"),
  Button: ({disabled, onClick, testID, text}: MockUiProps): React.ReactElement =>
    React.createElement(
      "Button",
      {
        accessibilityState: {disabled: Boolean(disabled)},
        disabled,
        onPress: disabled ? undefined : onClick,
        testID,
      },
      text
    ),
  Card: createUiElement("Card"),
  Heading: createUiElement("Heading"),
  Text: createUiElement("Text"),
  useStoredState: () => ["", async (): Promise<void> => undefined, false],
};

mock.module("@terreno/ui", () => uiMocks);
mock.module("../../ui/dist/index.js", () => uiMocks);
mock.module("../../ui/src/index.tsx", () => uiMocks);

mock.module("@/store/sdk", () => ({
  useSummarizeExampleTextMutation: () => [
    () => ({unwrap: async (): Promise<{output: string}> => ({output: ""})}),
    {isLoading: false},
  ],
}));

const syncDbSdkMocks = {
  useTodos: () => ({data: []}),
};

mock.module("@/store/syncDbSdk", () => syncDbSdkMocks);
mock.module("../store/syncDbSdk.ts", () => syncDbSdkMocks);
mock.module("../store/syncDbSdk", () => syncDbSdkMocks);
