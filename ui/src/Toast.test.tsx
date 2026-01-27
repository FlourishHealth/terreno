import {describe, expect, it, mock} from "bun:test";

import {Toast} from "./Toast";
import {renderWithTheme} from "./test-utils";

describe("Toast", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<Toast title="Test message" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders title correctly", () => {
    const {getByText} = renderWithTheme(<Toast title="Success!" />);
    expect(getByText("Success!")).toBeTruthy();
  });

  it("renders info variant (default)", () => {
    const {toJSON} = renderWithTheme(<Toast title="Info message" variant="info" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders success variant", () => {
    const {toJSON} = renderWithTheme(<Toast title="Success!" variant="success" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders warning variant", () => {
    const {toJSON} = renderWithTheme(<Toast title="Warning!" variant="warning" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders error variant", () => {
    const {toJSON} = renderWithTheme(<Toast title="Error!" variant="error" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with small size (default)", () => {
    const {toJSON} = renderWithTheme(<Toast size="sm" title="Small toast" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with large size", () => {
    const {toJSON} = renderWithTheme(<Toast size="lg" title="Large toast" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with subtitle when size is large", () => {
    const {getByText, toJSON} = renderWithTheme(
      <Toast size="lg" subtitle="Additional details here" title="Main message" />
    );
    expect(getByText("Main message")).toBeTruthy();
    expect(getByText("Additional details here")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders persistent toast with dismiss button", () => {
    const handleDismiss = mock(() => {});
    const {toJSON} = renderWithTheme(
      <Toast onDismiss={handleDismiss} persistent title="Persistent toast" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders dismiss button when persistent with onDismiss", () => {
    const handleDismiss = mock(() => {});
    const {toJSON} = renderWithTheme(
      <Toast onDismiss={handleDismiss} persistent title="Dismissible" />
    );
    // Verify dismiss button is rendered
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders all variants with large size correctly", () => {
    const variants = ["info", "success", "warning", "error"] as const;
    variants.forEach((variant) => {
      const {toJSON} = renderWithTheme(
        <Toast size="lg" subtitle="Details" title={`${variant} toast`} variant={variant} />
      );
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
