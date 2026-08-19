import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";

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
});
