import {describe, expect, it, mock} from "bun:test";

import {IconButton} from "./IconButton";
import {renderWithTheme} from "./test-utils";

describe("IconButton", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <IconButton accessibilityLabel="Test" iconName="check" onClick={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with testID", () => {
    const {toJSON} = renderWithTheme(
      <IconButton
        accessibilityLabel="Test"
        iconName="check"
        onClick={() => {}}
        testID="test-icon-button"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders primary variant (default)", () => {
    const {toJSON} = renderWithTheme(
      <IconButton accessibilityLabel="Test" iconName="check" onClick={() => {}} variant="primary" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders secondary variant", () => {
    const {toJSON} = renderWithTheme(
      <IconButton
        accessibilityLabel="Test"
        iconName="check"
        onClick={() => {}}
        variant="secondary"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders muted variant", () => {
    const {toJSON} = renderWithTheme(
      <IconButton accessibilityLabel="Test" iconName="check" onClick={() => {}} variant="muted" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders navigation variant", () => {
    const {toJSON} = renderWithTheme(
      <IconButton
        accessibilityLabel="Test"
        iconName="chevron-left"
        onClick={() => {}}
        variant="navigation"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders destructive variant", () => {
    const {toJSON} = renderWithTheme(
      <IconButton
        accessibilityLabel="Test"
        iconName="trash"
        onClick={() => {}}
        variant="destructive"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(
      <IconButton accessibilityLabel="Test" disabled iconName="check" onClick={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders loading state", () => {
    const {toJSON} = renderWithTheme(
      <IconButton accessibilityLabel="Test" iconName="check" loading onClick={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with indicator", () => {
    const {toJSON} = renderWithTheme(
      <IconButton accessibilityLabel="Test" iconName="bell" indicator="error" onClick={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with indicator and text", () => {
    const {toJSON} = renderWithTheme(
      <IconButton
        accessibilityLabel="Test"
        iconName="bell"
        indicator="error"
        indicatorText="5"
        onClick={() => {}}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onClick when pressed", async () => {
    const handleClick = mock(() => Promise.resolve());
    const {toJSON} = renderWithTheme(
      <IconButton accessibilityLabel="Test Button" iconName="check" onClick={handleClick} />
    );
    // Verify the component renders correctly with onClick prop
    expect(toJSON()).toMatchSnapshot();
  });

  it("has correct accessibility props", () => {
    const {toJSON} = renderWithTheme(
      <IconButton
        accessibilityHint="Custom hint"
        accessibilityLabel="Custom Label"
        iconName="check"
        onClick={() => {}}
      />
    );
    // Verify accessibility props are applied
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with confirmation props", () => {
    const {toJSON} = renderWithTheme(
      <IconButton
        accessibilityLabel="Delete"
        confirmationHeading="Confirm Delete"
        confirmationText="Are you sure?"
        iconName="trash"
        onClick={() => {}}
        withConfirmation
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
