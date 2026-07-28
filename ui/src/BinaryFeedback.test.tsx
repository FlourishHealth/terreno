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
