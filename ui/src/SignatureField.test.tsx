import {describe, expect, it, mock} from "bun:test";
import {forwardRef} from "react";
import {View} from "react-native";

import {SignatureField} from "./SignatureField";
import {renderWithTheme} from "./test-utils";

// Mock react-signature-canvas (used by Signature component)
mock.module("react-signature-canvas", () => ({
  default: forwardRef(({backgroundColor}: any, ref) => (
    <View ref={ref as any} style={{backgroundColor}} testID="signature-canvas" />
  )),
}));

describe("SignatureField", () => {
  const defaultProps = {
    onChange: () => {},
  };

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<SignatureField {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(SignatureField).toBeDefined();
    expect(typeof SignatureField).toBe("function");
  });

  it("renders with custom title", () => {
    const {getByText} = renderWithTheme(<SignatureField {...defaultProps} title="Sign Here" />);
    expect(getByText("Sign Here")).toBeTruthy();
  });

  it("renders disabled state with value", () => {
    const {toJSON} = renderWithTheme(
      <SignatureField
        {...defaultProps}
        disabled
        disabledText="Signature captured"
        value="data:image/png;base64,test"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state without value", () => {
    const {toJSON} = renderWithTheme(
      <SignatureField {...defaultProps} disabled disabledText="Signature not available" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with error text", () => {
    const {getByText} = renderWithTheme(
      <SignatureField {...defaultProps} errorText="Signature is required" />
    );
    expect(getByText("Signature is required")).toBeTruthy();
  });

  it("invokes onStart and onEnd callbacks via the Signature component", () => {
    const onStart = mock(() => {});
    const onEnd = mock(() => {});
    const onChange = mock((_v: string) => {});

    const {UNSAFE_getAllByProps} = renderWithTheme(
      <SignatureField onChange={onChange} onEnd={onEnd} onStart={onStart} />
    );

    // Find the inner Signature wrapper by looking for elements with onStart
    const elementsWithOnStart = UNSAFE_getAllByProps({}).filter(
      (el: any) => typeof el.props?.onStart === "function"
    );
    expect(elementsWithOnStart.length).toBeGreaterThan(0);
    const signatureEl = elementsWithOnStart[0];
    signatureEl.props.onStart();
    signatureEl.props.onEnd();
    expect(onStart).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
  });

  it("does not crash when onStart/onEnd are not provided", () => {
    const onChange = mock((_v: string) => {});
    const {UNSAFE_getAllByProps} = renderWithTheme(<SignatureField onChange={onChange} />);

    const elementsWithOnStart = UNSAFE_getAllByProps({}).filter(
      (el: any) => typeof el.props?.onStart === "function"
    );
    expect(elementsWithOnStart.length).toBeGreaterThan(0);
    const signatureEl = elementsWithOnStart[0];
    expect(() => signatureEl.props.onStart()).not.toThrow();
    expect(() => signatureEl.props.onEnd()).not.toThrow();
  });
});
