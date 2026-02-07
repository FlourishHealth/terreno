import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "./test-utils";
import {WebAddressAutocomplete} from "./WebAddressAutocomplete";

describe("WebAddressAutocomplete", () => {
  const defaultProps = {
    handleAddressChange: () => {},
    handleAutoCompleteChange: () => {},
    inputValue: "",
  };

  it("renders correctly without Google API key", () => {
    const {toJSON} = renderWithTheme(<WebAddressAutocomplete {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(WebAddressAutocomplete).toBeDefined();
    expect(typeof WebAddressAutocomplete).toBe("function");
  });

  it("renders with input value", () => {
    const {toJSON} = renderWithTheme(
      <WebAddressAutocomplete {...defaultProps} inputValue="123 Main St" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(<WebAddressAutocomplete {...defaultProps} disabled />);
    expect(toJSON()).toMatchSnapshot();
  });
});
