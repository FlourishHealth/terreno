import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {Platform as ImportedPlatform} from "react-native";

import {DataTableColumnFilterWeb} from "./dataTableFilters";
import {renderWithTheme} from "./test-utils";

describe("DataTableColumnFilterWeb", () => {
  const globalScope = globalThis as {document?: unknown; HTMLElement?: unknown};
  const originalDocument = globalScope.document;
  const originalHTMLElement = globalScope.HTMLElement;
  const originalPlatformOS = ImportedPlatform.OS;

  beforeEach(() => {
    (ImportedPlatform as {OS: string}).OS = "web";
    globalScope.HTMLElement = class FakeHTMLElement {};
    globalScope.document = {body: {}};
  });

  afterEach(() => {
    (ImportedPlatform as {OS: string}).OS = originalPlatformOS;
    globalScope.document = originalDocument;
    globalScope.HTMLElement = originalHTMLElement;
  });

  it("calls onApply with merged filter values when Apply is pressed", async () => {
    const onApply = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <DataTableColumnFilterWeb
        appliedValues={{}}
        columnTitle="Name"
        filter={{field: "name", kind: "text"}}
        onApply={onApply}
        testID="name-filter"
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("name-filter.trigger"));
    });
    await waitFor(() => {
      expect(getByTestId("name-filter.apply")).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("data-table-filter-name"), "alice");
    });
    await act(async () => {
      fireEvent.press(getByTestId("name-filter.apply"));
    });
    expect(onApply).toHaveBeenCalledWith({name: "alice"});
  });

  it("calls onApply with a single selected choice value", async () => {
    const onApply = mock(() => {});
    const {getByLabelText, getByTestId} = renderWithTheme(
      <DataTableColumnFilterWeb
        appliedValues={{}}
        columnTitle="Role"
        filter={{
          field: "role",
          kind: "choice",
          options: [
            {label: "Staff", value: "staff"},
            {label: "Admin", value: "admin"},
          ],
        }}
        onApply={onApply}
        testID="role-filter"
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("role-filter.trigger"));
    });
    await waitFor(() => {
      expect(getByLabelText("Staff")).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(getByLabelText("Staff"));
      fireEvent.press(getByTestId("role-filter.apply"));
    });
    expect(onApply).toHaveBeenCalledWith({role: ["staff"]});
  });
});
