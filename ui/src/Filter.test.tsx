import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {assert} from "chai";
// Filter.tsx reads `Platform.OS` through this ESM binding, so the web branch tests must mutate
// the same object the component observes.
import {Platform as ImportedPlatform} from "react-native";

import {Filter} from "./Filter";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("Filter", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <Filter>
        <Text>Body</Text>
      </Filter>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders the trigger label", () => {
    const {getByText} = renderWithTheme(
      <Filter label="Filters">
        <Text>Body</Text>
      </Filter>
    );
    expect(getByText("Filters")).toBeTruthy();
  });

  it("keeps the panel closed by default and open with defaultOpen", () => {
    const closed = renderWithTheme(
      <Filter testID="f">
        <Text>Body</Text>
      </Filter>
    );
    expect(closed.queryByTestId("f.panel")).toBeNull();

    const open = renderWithTheme(
      <Filter defaultOpen testID="f">
        <Text>Body</Text>
      </Filter>
    );
    expect(open.queryByTestId("f.panel")).toBeTruthy();
    expect(open.getByText("Body")).toBeTruthy();
  });

  it("hides the footer when action buttons are disabled", () => {
    const {queryByTestId} = renderWithTheme(
      <Filter defaultOpen showActionButtons={false} testID="f">
        <Text>Body</Text>
      </Filter>
    );
    expect(queryByTestId("f.apply")).toBeNull();
    expect(queryByTestId("f.clear")).toBeNull();
    expect(queryByTestId("f.cancel")).toBeNull();
  });

  it("closes on outside click and calls onCancel", () => {
    const onCancel = mock();
    const {getByTestId, queryByTestId} = renderWithTheme(
      <Filter defaultOpen onCancel={onCancel} testID="f">
        <Text>Body</Text>
      </Filter>
    );
    fireEvent.press(getByTestId("f.backdrop"));
    expect(onCancel).toHaveBeenCalled();
    expect(queryByTestId("f.panel")).toBeNull();
  });

  it("calls onClear and keeps the panel open when Clear is pressed", () => {
    const onClear = mock();
    const {getByTestId} = renderWithTheme(
      <Filter defaultOpen onClear={onClear} testID="f">
        <Text>Body</Text>
      </Filter>
    );
    fireEvent.press(getByTestId("f.clear"));
    expect(onClear).toHaveBeenCalled();
    expect(getByTestId("f.panel")).toBeTruthy();
  });

  it("calls onApply and closes when Apply is pressed", async () => {
    const onApply = mock();
    const {getByTestId, queryByTestId} = renderWithTheme(
      <Filter defaultOpen onApply={onApply} testID="f">
        <Text>Body</Text>
      </Filter>
    );
    await act(async () => {
      fireEvent.press(getByTestId("f.apply"));
    });
    await waitFor(() => {
      expect(onApply).toHaveBeenCalled();
    });
    expect(queryByTestId("f.panel")).toBeNull();
  });

  it("toggles the panel from the trigger when uncontrolled", async () => {
    const onOpenChange = mock();
    const {getByTestId, queryByTestId} = renderWithTheme(
      <Filter onOpenChange={onOpenChange} testID="f">
        <Text>Body</Text>
      </Filter>
    );

    await act(async () => {
      fireEvent.press(getByTestId("f.trigger"));
    });
    expect(queryByTestId("f.panel")).toBeTruthy();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    await act(async () => {
      fireEvent.press(getByTestId("f.trigger"));
    });
    expect(queryByTestId("f.panel")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("defers open state to the parent when controlled", async () => {
    const onOpenChange = mock();
    const {getByTestId, queryByTestId} = renderWithTheme(
      <Filter isOpen onOpenChange={onOpenChange} testID="f">
        <Text>Body</Text>
      </Filter>
    );

    // A controlled Filter must stay open until the parent flips `isOpen`, even after a
    // dismissal that would close an uncontrolled panel.
    await act(async () => {
      fireEvent.press(getByTestId("f.cancel"));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(queryByTestId("f.panel")).toBeTruthy();
  });

  it("renders only the requested footer buttons", () => {
    const {queryByTestId, getByTestId} = renderWithTheme(
      <Filter defaultOpen showApplyButton={false} showClearButton={false} testID="f">
        <Text>Body</Text>
      </Filter>
    );
    expect(queryByTestId("f.clear")).toBeNull();
    expect(queryByTestId("f.apply")).toBeNull();
    expect(getByTestId("f.cancel")).toBeTruthy();
  });

  it("hides the footer when every button is disabled", () => {
    const {queryByTestId} = renderWithTheme(
      <Filter
        defaultOpen
        showApplyButton={false}
        showCancelButton={false}
        showClearButton={false}
        testID="f"
      >
        <Text>Body</Text>
      </Filter>
    );
    expect(queryByTestId("f.clear")).toBeNull();
    expect(queryByTestId("f.apply")).toBeNull();
    expect(queryByTestId("f.cancel")).toBeNull();
  });

  it("uses custom footer button labels", () => {
    const {getByText} = renderWithTheme(
      <Filter
        applyButtonText="Save"
        cancelButtonText="Dismiss"
        clearButtonText="Reset"
        defaultOpen
        testID="f"
      >
        <Text>Body</Text>
      </Filter>
    );
    expect(getByText("Save")).toBeTruthy();
    expect(getByText("Dismiss")).toBeTruthy();
    expect(getByText("Reset")).toBeTruthy();
  });

  it("omits testIDs on the panel internals when no testID is provided", () => {
    const {queryByTestId, getByText} = renderWithTheme(
      <Filter defaultOpen>
        <Text>Body</Text>
      </Filter>
    );
    expect(getByText("Apply")).toBeTruthy();
    expect(queryByTestId("f.panel")).toBeNull();
  });
});

describe("Filter web platform", () => {
  const globalScope = globalThis as {document?: unknown; HTMLElement?: unknown};
  const originalDocument = globalScope.document;
  const originalHTMLElement = globalScope.HTMLElement;
  const originalPlatformOS = ImportedPlatform.OS;

  // The web branch requires `Platform.OS === "web"`, a `document`, and an `HTMLElement`
  // constructor (it checks `document.body instanceof HTMLElement` before portaling). The stub
  // body is intentionally not an HTMLElement so the overlay renders inline in the test tree
  // instead of going through a react-dom portal, which react-test-renderer cannot host.
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

  it("renders the fixed-position overlay once the trigger is measured", async () => {
    const {getByTestId, getByText} = renderWithTheme(
      <Filter defaultOpen testID="f">
        <Text>Body</Text>
      </Filter>
    );

    await waitFor(() => {
      expect(getByTestId("f.panel")).toBeTruthy();
    });
    const panelStyle = getByTestId("f.panel").props.style as {position?: string};
    assert.strictEqual(panelStyle.position, "fixed");
    expect(getByText("Body")).toBeTruthy();
  });

  it("closes from the web backdrop", async () => {
    const onCancel = mock();
    const {getByTestId, queryByTestId} = renderWithTheme(
      <Filter defaultOpen onCancel={onCancel} testID="f">
        <Text>Body</Text>
      </Filter>
    );

    await waitFor(() => {
      expect(getByTestId("f.backdrop")).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(getByTestId("f.backdrop"));
    });
    expect(onCancel).toHaveBeenCalled();
    expect(queryByTestId("f.panel")).toBeNull();
  });
});
