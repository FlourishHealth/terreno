import {describe, expect, it} from "bun:test";
import {Button} from "@terreno/ui";
import {within} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {ObservabilityTable} from "./ObservabilityTable";

describe("ObservabilityTable", () => {
  it("renders headers, string cells, and node cells in flow-height rows", () => {
    const longInput = `{"question":"${"a".repeat(120)}"}`;
    const {getByTestId} = renderWithTheme(
      <ObservabilityTable
        columns={[
          {minWidth: 200, title: "Input"},
          {minWidth: 110, title: "Trace"},
        ]}
        rows={[
          {cells: [longInput, <Button key="open" size="sm" text="Open trace" />], key: "item-1"},
          {cells: ["short", "—"], key: "item-2"},
        ]}
        testID="observability-table"
      />
    );
    const table = within(getByTestId("observability-table"));
    expect(table.getByText("Input")).toBeTruthy();
    expect(table.getByText("Trace")).toBeTruthy();
    expect(table.getByText("Open trace")).toBeTruthy();

    // Long values stay intact in the tree; the cell truncates visually instead of clipping the row.
    const longCell = table.getByText(longInput);
    assert.equal(longCell.props.numberOfLines, 3);
    expect(table.getByText("short")).toBeTruthy();
    expect(table.getByText("—")).toBeTruthy();
  });
});
