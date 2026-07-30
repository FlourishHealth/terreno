import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import type {TypedSignatureValue} from "./Common";
import {DEFAULT_SIGNATURE_FONTS, TypedSignatureField} from "./TypedSignatureField";
import {renderWithTheme} from "./test-utils";

describe("TypedSignatureField", () => {
  const defaultProps = {
    onChange: () => {},
  };

  it("component is defined", () => {
    expect(TypedSignatureField).toBeDefined();
    expect(typeof TypedSignatureField).toBe("function");
  });

  it("exposes a non-empty set of default fonts", () => {
    expect(DEFAULT_SIGNATURE_FONTS.length).toBeGreaterThan(0);
    for (const font of DEFAULT_SIGNATURE_FONTS) {
      expect(font.key).toBeTruthy();
      expect(font.label).toBeTruthy();
      expect(font.fontFamily).toBeTruthy();
    }
  });

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<TypedSignatureField {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders the default title and a preview of the typed name", () => {
    const {getByText, getAllByText} = renderWithTheme(
      <TypedSignatureField {...defaultProps} value={{fontKey: "caveat", typedName: "Jane Doe"}} />
    );
    expect(getByText("Signature")).toBeTruthy();
    // Name appears in both the input value and the live preview.
    expect(getAllByText("Jane Doe").length).toBeGreaterThan(0);
  });

  it("renders each font option as a pressable label", () => {
    const {getByText} = renderWithTheme(<TypedSignatureField {...defaultProps} />);
    for (const font of DEFAULT_SIGNATURE_FONTS) {
      expect(getByText(font.label)).toBeTruthy();
    }
  });

  it("emits the typed name with the current font key when the name changes", () => {
    const onChange = mock((_v: TypedSignatureValue) => {});
    const {UNSAFE_getAllByProps} = renderWithTheme(
      <TypedSignatureField onChange={onChange} value={{fontKey: "great-vibes", typedName: ""}} />
    );

    const inputs = UNSAFE_getAllByProps({}).filter(
      (el) => typeof el.props?.onChangeText === "function"
    );
    expect(inputs.length).toBeGreaterThan(0);
    inputs[0].props.onChangeText("Sam Smith");

    expect(onChange).toHaveBeenCalledWith({fontKey: "great-vibes", typedName: "Sam Smith"});
  });

  it("emits the selected font key while preserving the typed name", () => {
    const onChange = mock((_v: TypedSignatureValue) => {});
    const {getByText} = renderWithTheme(
      <TypedSignatureField onChange={onChange} value={{fontKey: "caveat", typedName: "Jane Doe"}} />
    );

    fireEvent.press(getByText("Great Vibes"));

    expect(onChange).toHaveBeenCalledWith({fontKey: "great-vibes", typedName: "Jane Doe"});
  });

  it("falls back to the first font when the stored font key is unknown", () => {
    const onChange = mock((_v: TypedSignatureValue) => {});
    const {UNSAFE_getAllByProps} = renderWithTheme(
      <TypedSignatureField onChange={onChange} value={{fontKey: "does-not-exist", typedName: ""}} />
    );

    const inputs = UNSAFE_getAllByProps({}).filter(
      (el) => typeof el.props?.onChangeText === "function"
    );
    inputs[0].props.onChangeText("Ann Lee");

    expect(onChange).toHaveBeenCalledWith({
      fontKey: DEFAULT_SIGNATURE_FONTS[0].key,
      typedName: "Ann Lee",
    });
  });

  it("renders an error message when errorText is provided", () => {
    const {getByText} = renderWithTheme(
      <TypedSignatureField {...defaultProps} errorText="Signature is required" />
    );
    expect(getByText("Signature is required")).toBeTruthy();
  });
});
