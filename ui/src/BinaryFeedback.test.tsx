import {describe, expect, it, jest} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {BinaryFeedback} from "./BinaryFeedback";
import {renderWithTheme} from "./test-utils";

describe("BinaryFeedback", () => {
  it("renders both options", () => {
    const {getByTestId} = renderWithTheme(
      <BinaryFeedback onChange={jest.fn()} testID="feedback" />
    );
    expect(getByTestId("feedback-positive")).toBeTruthy();
    expect(getByTestId("feedback-negative")).toBeTruthy();
  });

  it("calls onChange with the pressed value", () => {
    const onChange = jest.fn();
    const {getByTestId} = renderWithTheme(<BinaryFeedback onChange={onChange} testID="feedback" />);
    fireEvent.press(getByTestId("feedback-negative"));
    expect(onChange).toHaveBeenCalledWith("negative");
  });

  it("clears the selection when pressing the selected option", () => {
    const onChange = jest.fn();
    const {getByTestId} = renderWithTheme(
      <BinaryFeedback onChange={onChange} testID="feedback" value="positive" />
    );
    fireEvent.press(getByTestId("feedback-positive"));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("exposes the selection and custom labels to assistive technology", () => {
    const {getByTestId} = renderWithTheme(
      <BinaryFeedback
        negativeAccessibilityLabel="Not helpful"
        onChange={jest.fn()}
        positiveAccessibilityLabel="Helpful"
        testID="feedback"
        value="negative"
      />
    );
    const positive = getByTestId("feedback-positive");
    const negative = getByTestId("feedback-negative");
    expect(positive.props.accessibilityLabel).toBe("Helpful");
    expect(negative.props.accessibilityLabel).toBe("Not helpful");
    expect(positive.props.accessibilityState.selected).toBe(false);
    expect(negative.props.accessibilityState.selected).toBe(true);
    // react-native-web ignores accessibilityState, so the flat aria prop is what reaches the DOM.
    expect(positive.props["aria-checked"]).toBe(false);
    expect(negative.props["aria-checked"]).toBe(true);
  });

  it("activates on the spacebar, which react-native-web only handles for buttons", async () => {
    const onChange = jest.fn();
    const preventDefault = jest.fn();
    const {getByTestId} = renderWithTheme(<BinaryFeedback onChange={onChange} testID="feedback" />);
    await getByTestId("feedback-positive").props.onKeyDown({key: " ", preventDefault});
    expect(preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("positive");
  });

  it("ignores other keys so react-native-web keeps handling enter", async () => {
    const onChange = jest.fn();
    const preventDefault = jest.fn();
    const {getByTestId} = renderWithTheme(<BinaryFeedback onChange={onChange} testID="feedback" />);
    await getByTestId("feedback-positive").props.onKeyDown({key: "Enter", preventDefault});
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not call onChange when disabled", () => {
    const onChange = jest.fn();
    const {getByTestId} = renderWithTheme(
      <BinaryFeedback disabled onChange={onChange} testID="feedback" />
    );
    fireEvent.press(getByTestId("feedback-positive"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
