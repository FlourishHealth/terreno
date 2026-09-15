import {describe, expect, it} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import type {ReactTestRendererJSON} from "react-test-renderer";

import {renderWithTheme} from "../../ui/src/test-utils";
import type {DemoConfiguration} from "../demoConfig";
import {DemoConfig} from "../demoConfig";
import {DemoCard} from "./DemoCard";

const noop = (): void => {};

const testIdFor = (name: string): string => `demo-home-${name.toLowerCase().replace(/\s+/g, "-")}`;

const isPressableNode = (node: ReactTestRendererJSON): boolean => {
  const role = node.props?.accessibilityRole ?? node.props?.role;
  return role === "button" || role === "link";
};

/**
 * Collects the labels of pressables that are rendered inside another pressable. On web a
 * pressable is a real <button>, and the HTML parser cannot nest one inside another: it closes
 * the outer button early and reparents every following node, which pushes the rest of the demo
 * grid out of #root and onto <body>.
 */
const findNestedPressables = (
  node: ReactTestRendererJSON | string | null,
  insidePressable = false
): string[] => {
  if (!node || typeof node === "string") {
    return [];
  }
  const nested: string[] = [];
  const isPressable = isPressableNode(node);
  if (isPressable && insidePressable) {
    nested.push(String(node.props?.accessibilityLabel ?? node.props?.testID ?? node.type));
  }
  for (const child of node.children ?? []) {
    nested.push(
      ...findNestedPressables(child as ReactTestRendererJSON, insidePressable || isPressable)
    );
  }
  return nested;
};

describe("DemoCard", () => {
  it("exposes the press target for every configured demo", () => {
    const config = DemoConfig[0];
    if (!config) {
      throw new Error("DemoConfig is empty");
    }
    const {getByTestId} = renderWithTheme(<DemoCard config={config} onPress={noop} />);
    expect(getByTestId(testIdFor(config.name))).toBeTruthy();
  });

  it("reports the component name when the press target is pressed", () => {
    const config = DemoConfig[0];
    if (!config) {
      throw new Error("DemoConfig is empty");
    }
    const pressed: string[] = [];
    const {getByTestId} = renderWithTheme(
      <DemoCard
        config={config}
        onPress={(componentName) => {
          pressed.push(componentName);
        }}
      />
    );
    fireEvent.press(getByTestId(testIdFor(config.name)));
    expect(pressed).toEqual([config.name]);
  });

  it("renders nothing when the configuration has no demo", () => {
    const config = DemoConfig[0];
    if (!config) {
      throw new Error("DemoConfig is empty");
    }
    const {toJSON} = renderWithTheme(
      <DemoCard
        config={{...config, demo: undefined} as unknown as DemoConfiguration}
        onPress={noop}
      />
    );
    expect(toJSON()).toBeNull();
  });

  for (const config of DemoConfig) {
    it(`renders ${config.name} without nesting a pressable inside a pressable`, () => {
      const {toJSON} = renderWithTheme(<DemoCard config={config} onPress={noop} />);
      const tree = toJSON() as ReactTestRendererJSON | null;
      expect(findNestedPressables(tree)).toEqual([]);
    });
  }
});
