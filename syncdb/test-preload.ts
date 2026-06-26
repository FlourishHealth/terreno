import {mock} from "bun:test";

// @testing-library/react-native pulls in react-native; provide the minimal
// surface needed so hook tests run under bun without the native runtime.
mock.module("react-native", () => ({
  AppState: {
    addEventListener: () => ({remove: () => {}}),
    currentState: "active",
  },
  Platform: {OS: "web", select: (specifics: {default?: unknown}) => specifics.default},
  StyleSheet: {create: (styles: unknown) => styles},
}));
