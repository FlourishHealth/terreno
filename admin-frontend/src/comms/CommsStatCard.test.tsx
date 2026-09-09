import {describe, expect, it} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import {CommsStatCard} from "./CommsStatCard";

const findByProp = (
  tree: Record<string, unknown> | null,
  predicate: (node: Record<string, unknown>) => boolean
): Record<string, unknown> | undefined => {
  if (!tree) {
    return undefined;
  }
  if (predicate(tree)) {
    return tree;
  }
  const children = (tree.children ?? []) as Array<Record<string, unknown>>;
  for (const child of children) {
    const match = findByProp(child, predicate);
    if (match) {
      return match;
    }
  }
  return undefined;
};

describe("CommsStatCard", () => {
  it("renders a neutral metric on the base surface without an alert icon", () => {
    const {getByText, queryByText} = renderWithTheme(
      <CommsStatCard label="Delivered" testID="comms-stat-delivered" value="12" />
    );
    expect(getByText("Delivered")).toBeTruthy();
    expect(getByText("12")).toBeTruthy();
    expect(queryByText("2 of 4 failed")).toBeNull();
  });

  it("tints the alert tone instead of putting default text on a saturated fill", () => {
    const neutral = renderWithTheme(
      <CommsStatCard label="Failed" testID="comms-stat-failed" value="0" />
    );
    const alert = renderWithTheme(
      <CommsStatCard
        caption="100% failure rate"
        label="Failed"
        testID="comms-stat-failed"
        tone="alert"
        value="1"
      />
    );

    const neutralCard = findByProp(
      neutral.toJSON() as Record<string, unknown> | null,
      (node) => (node.props as {testID?: string})?.testID === "comms-stat-failed"
    );
    const alertCard = findByProp(
      alert.toJSON() as Record<string, unknown> | null,
      (node) => (node.props as {testID?: string})?.testID === "comms-stat-failed"
    );

    const backgroundOf = (node?: Record<string, unknown>): string | undefined => {
      const style = (node?.props as {style?: Record<string, unknown>})?.style;
      return style?.backgroundColor as string | undefined;
    };

    // Light error tint (error000), not the saturated error200 fill the old card used.
    expect(backgroundOf(alertCard)).toBe("#FDD7D7");
    expect(backgroundOf(alertCard)).not.toBe(backgroundOf(neutralCard));
    expect(alert.getByText("100% failure rate")).toBeTruthy();
  });
});
