import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "./test-utils";
import {UnifiedAddressAutoCompleteField} from "./UnifiedAddressAutoComplete";

describe("UnifiedAddressAutoCompleteField", () => {
  const defaultProps = {
    handleAddressChange: () => {},
    handleAutoCompleteChange: () => {},
    inputValue: "",
  };

  it("renders plain TextField when no API key provided", () => {
    const {toJSON} = renderWithTheme(<UnifiedAddressAutoCompleteField {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders plain TextField when API key is invalid", () => {
    const {toJSON} = renderWithTheme(
      <UnifiedAddressAutoCompleteField {...defaultProps} googleMapsApiKey="invalid!key" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders WebAddressAutocomplete when valid API key provided on web", () => {
    const {toJSON} = renderWithTheme(
      <UnifiedAddressAutoCompleteField
        {...defaultProps}
        googleMapsApiKey="test-dummy-key-not-real-0123456789"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(
      <UnifiedAddressAutoCompleteField {...defaultProps} disabled />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with input value", () => {
    const {toJSON} = renderWithTheme(
      <UnifiedAddressAutoCompleteField {...defaultProps} inputValue="123 Main St" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with testID", () => {
    const {toJSON} = renderWithTheme(
      <UnifiedAddressAutoCompleteField {...defaultProps} testID="address-field" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
