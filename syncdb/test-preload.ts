import {mock} from "bun:test";

mock.module("react-native", () => ({
  Platform: {OS: "web"},
}));
