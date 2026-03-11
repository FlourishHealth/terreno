import {describe, expect, it, mock} from "bun:test";
import {forwardRef} from "react";
import {Text, View} from "react-native";

import {MobileAddressAutocomplete} from "./MobileAddressAutoComplete";
import {renderWithTheme} from "./test-utils";

// Mock react-native-google-places-autocomplete
mock.module("react-native-google-places-autocomplete", () => ({
  GooglePlacesAutocomplete: forwardRef(({placeholder}: any, ref) => (
    <View ref={ref as any} testID="google-places-autocomplete">
      <Text>{placeholder}</Text>
    </View>
  )),
}));

describe("MobileAddressAutocomplete", () => {
  const defaultProps = {
    handleAddressChange: () => {},
    handleAutoCompleteChange: () => {},
    inputValue: "",
  };

  it("renders correctly with Google API key", () => {
    const {toJSON} = renderWithTheme(
      <MobileAddressAutocomplete {...defaultProps} googleMapsApiKey="test-api-key" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(MobileAddressAutocomplete).toBeDefined();
    expect(typeof MobileAddressAutocomplete).toBe("function");
  });

  it("renders TextField fallback without Google API key", () => {
    const {toJSON} = renderWithTheme(<MobileAddressAutocomplete {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(
      <MobileAddressAutocomplete {...defaultProps} disabled googleMapsApiKey="test-api-key" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with input value", () => {
    const {toJSON} = renderWithTheme(
      <MobileAddressAutocomplete
        {...defaultProps}
        googleMapsApiKey="test-api-key"
        inputValue="123 Main St"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
