import type {FC} from "react";
import {View} from "react-native";

import type {AddressFieldProps, AddressInterface} from "./Common";
import {USSTATESLIST} from "./Constants";
import {SelectField} from "./SelectField";
import {TextField} from "./TextField";
import {UnifiedAddressAutoCompleteField} from "./UnifiedAddressAutoComplete";

export const AddressField: FC<AddressFieldProps> = ({
  disabled,
  googleMapsApiKey,
  googlePlacesMobileStyles,
  includeCounty,
  value,
  testID,
  onChange,
  onBlur,
}) => {
  const handleAddressChange = (field: string, newValue: string) => {
    onChange({...value, [field]: newValue});
    onBlur?.({...value, [field]: newValue});
  };

  const handleAutoCompleteChange = (newValue: AddressInterface) => {
    onChange({...value, ...newValue});
  };

  const {
    address1 = "",
    address2 = "",
    city = "",
    state = "",
    zipcode = "",
    countyName = "",
    countyCode = "",
  }: AddressInterface = value ?? ({} as AddressInterface);

  return (
    <>
      <View style={{marginBottom: 16}}>
        <UnifiedAddressAutoCompleteField
          disabled={disabled}
          googleMapsApiKey={googleMapsApiKey}
          googlePlacesMobileStyles={googlePlacesMobileStyles}
          handleAddressChange={(result) => handleAddressChange("address1", result)}
          handleAutoCompleteChange={(result) => handleAutoCompleteChange(result)}
          includeCounty={includeCounty}
          inputValue={address1}
          testID={`${testID}-address1`}
        />
      </View>
      <View style={{marginBottom: 16}}>
        <TextField
          disabled={disabled}
          id="address2"
          onChange={(result) => handleAddressChange("address2", result)}
          testID={`${testID}-address2`}
          title="Apt, suite, etc"
          type="text"
          value={address2}
        />
      </View>
      <View style={{marginBottom: 16}}>
        <TextField
          disabled={disabled}
          id="city"
          onChange={(result) => handleAddressChange("city", result)}
          testID={`${testID}-city`}
          title="City"
          type="text"
          value={city}
        />
      </View>
      <View style={{marginBottom: 16}}>
        <SelectField
          onChange={(result) => handleAddressChange("state", result!)}
          options={USSTATESLIST}
          title="State"
          value={state}
        />
      </View>
      <View style={{marginBottom: 16}}>
        <TextField
          disabled={disabled}
          id="zipcode"
          onChange={(result) => handleAddressChange("zipcode", result)}
          testID={`${testID}-zip`}
          title="Zipcode"
          type="text"
          value={zipcode}
        />
      </View>
      {includeCounty && (
        <>
          <View style={{marginBottom: 16}}>
            <TextField
              disabled={disabled}
              id="countyName"
              onChange={(result) => handleAddressChange("countyName", result)}
              testID={`${testID}-county`}
              title="County Name"
              type="text"
              value={countyName}
            />
          </View>
          <View style={{marginBottom: 16}}>
            <TextField
              disabled={disabled}
              id="countyCode"
              onChange={(result) => handleAddressChange("countyCode", result)}
              testID={`${testID}-county-code`}
              title="County Code"
              type="text"
              value={countyCode}
            />
          </View>
        </>
      )}
    </>
  );
};
