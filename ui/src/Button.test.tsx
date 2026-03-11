import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";

import {Button} from "./Button";
import {renderWithTheme} from "./test-utils";

describe("Button", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<Button onClick={() => {}} text="Click me" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders button text correctly", () => {
    const {getByText} = renderWithTheme(<Button onClick={() => {}} text="Submit" />);
    expect(getByText("Submit")).toBeTruthy();
  });

  it("renders with testID", () => {
    const {getByTestId} = renderWithTheme(
      <Button onClick={() => {}} testID="test-button" text="Test" />
    );
    expect(getByTestId("test-button")).toBeTruthy();
  });

  // Variant tests
  it("renders primary variant", () => {
    const {toJSON} = renderWithTheme(
      <Button onClick={() => {}} text="Primary" variant="primary" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders secondary variant", () => {
    const {toJSON} = renderWithTheme(
      <Button onClick={() => {}} text="Secondary" variant="secondary" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders muted variant", () => {
    const {toJSON} = renderWithTheme(<Button onClick={() => {}} text="Muted" variant="muted" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders outline variant", () => {
    const {toJSON} = renderWithTheme(
      <Button onClick={() => {}} text="Outline" variant="outline" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders destructive variant", () => {
    const {toJSON} = renderWithTheme(
      <Button onClick={() => {}} text="Delete" variant="destructive" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // Disabled state
  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(<Button disabled onClick={() => {}} text="Disabled" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("applies disabled styles when disabled", () => {
    const {toJSON} = renderWithTheme(<Button disabled onClick={() => {}} text="Disabled" />);
    // The button should render with disabled styling
    expect(toJSON()).toMatchSnapshot();
  });

  // Loading state
  it("renders loading state", () => {
    const {toJSON} = renderWithTheme(<Button loading onClick={() => {}} text="Loading" />);
    expect(toJSON()).toMatchSnapshot();
  });

  // fullWidth
  it("renders fullWidth button", () => {
    const {toJSON} = renderWithTheme(<Button fullWidth onClick={() => {}} text="Full Width" />);
    expect(toJSON()).toMatchSnapshot();
  });

  // Icon tests
  it("renders with icon on left", () => {
    const {toJSON} = renderWithTheme(
      <Button iconName="check" onClick={() => {}} text="With Icon" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with icon on right", () => {
    const {toJSON} = renderWithTheme(
      <Button iconName="arrow-right" iconPosition="right" onClick={() => {}} text="Next" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  // Click handling
  it("calls onClick when pressed", async () => {
    const handleClick = mock(() => Promise.resolve());
    const {getByText} = renderWithTheme(<Button onClick={handleClick} text="Click" />);

    await act(async () => {
      fireEvent.press(getByText("Click"));
      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(handleClick).toHaveBeenCalled();
    });
  });

  // Confirmation modal tests
  it("renders with confirmation modal props", () => {
    const {toJSON} = renderWithTheme(
      <Button
        confirmationText="Are you sure?"
        modalSubTitle="This action cannot be undone"
        modalTitle="Confirm Delete"
        onClick={() => {}}
        text="Delete"
        withConfirmation
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("shows confirmation modal when withConfirmation is true and button is pressed", async () => {
    const handleClick = mock(() => Promise.resolve());
    const {getByText, queryByText} = renderWithTheme(
      <Button
        confirmationText="Are you sure you want to proceed?"
        modalTitle="Confirm Action"
        onClick={handleClick}
        text="Press Me"
        withConfirmation
      />
    );

    await act(async () => {
      fireEvent.press(getByText("Press Me"));
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // The confirmation modal should now be visible with the modal title
    await waitFor(
      () => {
        expect(queryByText("Confirm Action")).toBeTruthy();
      },
      {timeout: 2000}
    );
  });

  // Accessibility
  it("has correct accessibility props", () => {
    const {getByLabelText} = renderWithTheme(<Button onClick={() => {}} text="Accessible" />);
    expect(getByLabelText("Accessible")).toBeTruthy();
  });
});
