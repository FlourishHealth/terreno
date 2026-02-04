import {describe, expect, it, mock} from "bun:test";
import {forwardRef} from "react";
import {Text, View} from "react-native";
import {renderWithTheme} from "./test-utils";
import {UnifiedAddressAutoCompleteField} from "./UnifiedAddressAutoComplete";

// Mock react-native-google-places-autocomplete (used by MobileAddressAutocomplete)
mock.module("react-native-google-places-autocomplete", () => ({
  GooglePlacesAutocomplete: forwardRef(({placeholder}: any, ref) => (
    <View ref={ref as any} testID="google-places-autocomplete">
      <Text>{placeholder}</Text>
    </View>
  )),
}));

describe("UnifiedAddressAutoCompleteField", () => {
  const defaultProps = {
    handleAddressChange: () => {},
    handleAutoCompleteChange: () => {},
    inputValue: "",
  };

  it("renders correctly without Google API key (fallback to TextField)", () => {
    const {toJSON} = renderWithTheme(<UnifiedAddressAutoCompleteField {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(UnifiedAddressAutoCompleteField).toBeDefined();
    expect(typeof UnifiedAddressAutoCompleteField).toBe("function");
  });

  it("renders with input value", () => {
    const {toJSON} = renderWithTheme(
      <UnifiedAddressAutoCompleteField {...defaultProps} inputValue="123 Main St" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(
      <UnifiedAddressAutoCompleteField {...defaultProps} disabled />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with invalid Google API key (falls back to TextField)", () => {
    const {toJSON} = renderWithTheme(
      <UnifiedAddressAutoCompleteField {...defaultProps} googleMapsApiKey="invalid" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
