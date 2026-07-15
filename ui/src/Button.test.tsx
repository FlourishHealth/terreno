import {describe, expect, it, mock, spyOn} from "bun:test";
import {act, fireEvent, render, waitFor} from "@testing-library/react-native";

import {Button} from "./Button";
import type {ButtonProps} from "./Common";
import {isMobileDevice} from "./MediaQuery";
import {renderWithIcons, renderWithTheme, TEST_CUSTOM_ICON_TEST_ID} from "./test-utils";
import * as Utilities from "./Utilities";

const ACTIVE_BUTTON_VARIANTS: {
  backgroundColor: string;
  variant: NonNullable<ButtonProps["variant"]>;
}[] = [
  {backgroundColor: "#2B6072", variant: "primary"},
  {backgroundColor: "#0E9DCD", variant: "secondary"},
  {backgroundColor: "#0E9DCD", variant: "muted"},
  {backgroundColor: "#0E9DCD", variant: "outline"},
  {backgroundColor: "#BD1111", variant: "destructive"},
  {backgroundColor: "#0E9DCD", variant: "ghost"},
];

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

  for (const {backgroundColor, variant} of ACTIVE_BUTTON_VARIANTS) {
    it(`renders ${variant} variant in active state`, () => {
      const {getByTestId, getByText} = renderWithTheme(
        <Button
          onClick={() => {}}
          state="active"
          testID={`${variant}-active`}
          text={`${variant} active`}
          variant={variant}
        />
      );

      expect(getByTestId(`${variant}-active`)).toHaveStyle({backgroundColor});
      expect(getByText(`${variant} active`)).toHaveStyle({color: "#FFFFFF"});
    });
  }

  it("removes the outline border in active state", () => {
    const {getByTestId} = renderWithTheme(
      <Button
        onClick={() => {}}
        state="active"
        testID="outline-active"
        text="Outline active"
        variant="outline"
      />
    );

    expect(getByTestId("outline-active")).not.toHaveStyle({borderWidth: 2});
  });

  it("keeps disabled styling when state is active", () => {
    const {getByTestId} = renderWithTheme(
      <Button
        disabled
        onClick={() => {}}
        state="active"
        testID="disabled-active"
        text="Disabled active"
      />
    );

    expect(getByTestId("disabled-active")).toHaveStyle({backgroundColor: "#9A9A9A"});
  });

  it("defaults to scale press animation", () => {
    const tree = renderWithTheme(<Button onClick={() => {}} text="Default animation" />).toJSON();
    expect(Array.isArray(tree)).toBe(false);
    expect(tree?.type).toBe("PressableScale");
  });

  it("renders opacity press animation", () => {
    const tree = renderWithTheme(
      <Button onClick={() => {}} pressAnimation="opacity" text="Opacity" />
    ).toJSON();
    expect(Array.isArray(tree)).toBe(false);
    expect(tree?.type).toBe("PressableOpacity");
  });

  it("renders no press animation", () => {
    const tree = renderWithTheme(
      <Button onClick={() => {}} pressAnimation="none" text="No animation" />
    ).toJSON();
    expect(Array.isArray(tree)).toBe(false);
    expect(tree?.type).toBe("PressableWithoutFeedback");
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

  it("does not call onClick again on the trailing debounce edge after rapid presses", async () => {
    const handleClick = mock(() => Promise.resolve());
    const {getByText} = renderWithTheme(<Button onClick={handleClick} text="Click" />);

    await act(async () => {
      fireEvent.press(getByText("Click"));
      fireEvent.press(getByText("Click"));
      await new Promise((resolve) => setTimeout(resolve, 700));
    });

    expect(handleClick).toHaveBeenCalledTimes(1);
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

  it("invokes onClick when confirmation primary button is pressed", async () => {
    const handleClick = mock(() => Promise.resolve());
    const {getByText, queryByText} = renderWithTheme(
      <Button
        confirmationText="Confirm action?"
        modalTitle="Confirm Title"
        onClick={handleClick}
        text="Press Me"
        withConfirmation
      />
    );

    await act(async () => {
      fireEvent.press(getByText("Press Me"));
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    // Wait for confirmation modal
    await waitFor(
      () => {
        expect(queryByText("Confirm Title")).toBeTruthy();
      },
      {timeout: 2000}
    );

    await act(async () => {
      fireEvent.press(getByText("Confirm"));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(handleClick).toHaveBeenCalled();
    });
  });

  it("dismisses confirmation modal when secondary button is pressed", async () => {
    const handleClick = mock(() => Promise.resolve());
    const {getByText, queryByText} = renderWithTheme(
      <Button
        confirmationText="Confirm action?"
        modalTitle="Confirm Title"
        onClick={handleClick}
        text="Press Me"
        withConfirmation
      />
    );

    await act(async () => {
      fireEvent.press(getByText("Press Me"));
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    await waitFor(
      () => {
        expect(queryByText("Cancel")).toBeTruthy();
      },
      {timeout: 2000}
    );

    // Cancel does not throw and does not invoke onClick
    expect(() => fireEvent.press(getByText("Cancel"))).not.toThrow();
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders with tooltip on desktop (wrapped in Tooltip)", () => {
    const {toJSON} = renderWithTheme(
      <Button onClick={() => {}} text="Hover me" tooltipText="Tooltip text" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without a ThemeProvider using default context theme", () => {
    const {toJSON} = render(<Button onClick={() => {}} text="No theme" />);
    // The ThemeContext provides a default computed theme, so the button renders
    expect(toJSON()).toBeTruthy();
  });

  it("uses Pressable when disabled (not PressableScale)", () => {
    const tree = renderWithTheme(<Button disabled onClick={() => {}} text="Disabled" />).toJSON();
    expect(Array.isArray(tree)).toBe(false);
    expect(tree?.type).toBe("Pressable");
  });

  it("uses Pressable when loading (not PressableScale)", () => {
    const tree = renderWithTheme(<Button loading onClick={() => {}} text="Loading" />).toJSON();
    expect(Array.isArray(tree)).toBe(false);
    expect(tree?.type).toBe("Pressable");
  });

  it("renders with custom confirmationText and modalSubTitle", () => {
    const {toJSON} = renderWithTheme(
      <Button
        confirmationText="Custom confirmation text"
        modalSubTitle="Custom subtitle"
        modalTitle="Custom Title"
        onClick={() => {}}
        text="Confirm Btn"
        withConfirmation
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  describe("custom icons", () => {
    it("renders a registered custom icon by name", () => {
      const {queryByTestId} = renderWithIcons(
        <Button iconName="testCustomIcon" onClick={() => {}} text="Custom" />
      );
      expect(queryByTestId(TEST_CUSTOM_ICON_TEST_ID)).not.toBeNull();
    });

    it("renders a FontAwesome icon (not the custom one) for unregistered names", () => {
      const {queryByTestId, getByText} = renderWithIcons(
        <Button iconName="check" onClick={() => {}} text="FontAwesome" />
      );
      expect(queryByTestId(TEST_CUSTOM_ICON_TEST_ID)).toBeNull();
      expect(getByText("FontAwesome")).toBeTruthy();
    });
  });

  it("renders disabled button and does not call onClick", () => {
    const handleClick = mock(() => Promise.resolve());
    const {getByText} = renderWithTheme(<Button disabled onClick={handleClick} text="Disabled" />);
    fireEvent.press(getByText("Disabled"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("shows loading indicator when loading prop is true", () => {
    const {toJSON} = renderWithTheme(<Button loading onClick={() => {}} text="Loading" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders ghost variant with correct styles", () => {
    const {toJSON} = renderWithTheme(<Button onClick={() => {}} text="Ghost" variant="ghost" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with size sm", () => {
    const tree = renderWithTheme(<Button onClick={() => {}} size="sm" text="Small" />).toJSON();
    expect(tree).toBeTruthy();
  });

  it("does not render tooltip wrapper when isMobileDevice is true", () => {
    const nativeSpy = spyOn(Utilities, "isNative").mockReturnValue(false);
    (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => true);

    const {getByText, toJSON} = renderWithTheme(
      <Button onClick={() => {}} text="No Tooltip" tooltipText="Should not wrap" />
    );

    expect(getByText("No Tooltip")).toBeTruthy();
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain("Should not wrap");
    nativeSpy.mockRestore();
    (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => false);
  });

  it("renders tooltip wrapper when tooltipText is provided and not native", () => {
    const nativeSpy = spyOn(Utilities, "isNative").mockReturnValue(false);
    (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => false);

    const {getByText} = renderWithTheme(
      <Button onClick={() => {}} text="With Tooltip" tooltipText="Helpful tip" />
    );

    expect(getByText("With Tooltip")).toBeTruthy();
    nativeSpy.mockRestore();
    (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => false);
  });
});
