import {type AddressInterface, Box, Field, Heading, TapToEdit, Text} from "ferns-ui";
import {printDateAndTime} from "ferns-ui/dist/DateUtilities";
import {DateTime} from "luxon";
import {useState} from "react";
import {Image} from "react-native";

import {StorybookContainer} from "./StorybookContainer";

export const TextFieldStory = () => {
  const [value, setValue] = useState("Pre-filled text");
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        title="Text Field"
        type="text"
        value={value}
      />
    </StorybookContainer>
  );
};

export const BooleanFieldStory = () => {
  const [value, setValue] = useState<boolean>(true);
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        title="Boolean Field"
        type="boolean"
        value={value}
      />
    </StorybookContainer>
  );
};

export const FieldWithErrorStory = () => {
  const [value, setValue] = useState("");
  return (
    <StorybookContainer>
      <Field
        errorText={value.length > 1 ? "Error message" : undefined}
        helperText="Only enter 1 character, enter 2 to see the error label"
        onChange={setValue}
        title="Field with error"
        type="text"
        value={value}
      />
    </StorybookContainer>
  );
};

export const EmailTextFieldStory = () => {
  const [value, setValue] = useState("test@email.com");
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        title="Email Field"
        type="email"
        value={value}
      />
    </StorybookContainer>
  );
};

export const TextAreaFieldStory = () => {
  const [value, setValue] = useState("this is my placeholder");
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        placeholder="this is my placeholder"
        title="TextArea Field"
        type="textarea"
        value={value}
      />
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        placeholder="this is my placeholder"
        rows={10}
        title="Large TextArea "
        type="textarea"
        value={value}
      />
    </StorybookContainer>
  );
};

export const NumberFieldStory = () => {
  const [value, setValue] = useState("123");
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        title="Number Field"
        type="number"
        value={value}
      />
    </StorybookContainer>
  );
};

// export const CurrencyFieldStory = () => {
//   const [value, setValue] = useState(1234.56);
//   return (
//     <StorybookContainer>
//       <Field
//         helperText="Here's some help text"
//         title="Currency Field"
//         type="currency"
//         value={value}
//         onChange={setValue}
//       />
//     </StorybookContainer>
//   );
// };

// export const PercentFieldStory = () => {
//   const [value, setValue] = useState(0.12);
//   return (
//     <StorybookContainer>
//       <Field
//         helperText="Here's some help text"
//         title="Percent Field"
//         type="percent"
//         value={value}
//         onChange={setValue}
//       />
//     </StorybookContainer>
//   );
// };

export const SelectFieldStory = () => {
  const [value, setValue] = useState<string | undefined>();
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        options={[
          {label: "Option 1", value: "Option 1"},
          {label: "Option 2", value: "Option 2"},
          {label: "Option 3", value: "Option 3"},
          {label: "Option 4", value: "Option 4"},
          {label: "Option 5", value: "Option 5"},
          {label: "Option 6", value: "Option 6"},
        ]}
        placeholder="Select option"
        title="Select Field"
        type="select"
        value={value}
      />
      <Text>This is the select value: {value}</Text>
    </StorybookContainer>
  );
};

export const PasswordFieldStory = () => {
  const [value, setValue] = useState("mypassword");
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        title="Password Field"
        type="password"
        value={value}
      />
    </StorybookContainer>
  );
};

export const URLFieldStory = () => {
  const [value, setValue] = useState("https://www.flourish.health");
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        title="URL Field"
        type="url"
        value={value}
      />
    </StorybookContainer>
  );
};

export const PhoneNumberFieldStory = () => {
  const [value, setValue] = useState("+15558675309");
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={setValue}
        title="Phone Number Field"
        type="phoneNumber"
        value={value}
      />
      <Text>Phone number return: {value}</Text>
    </StorybookContainer>
  );
};

export const DateAndTimeFieldStory = () => {
  const [dateValue, setDateValue] = useState<string>(DateTime.now().toISO());
  const [timezone, setTimezone] = useState<string | undefined>(DateTime.now().zone.name);
  return (
    <StorybookContainer>
      <Field
        helperText="Here's some help text"
        onChange={(value) => {
          setDateValue(value);
        }}
        onTimezoneChange={setTimezone}
        timezone={timezone}
        title="Date Time Field"
        type="datetime"
        value={dateValue}
      />
      <Field
        disabled
        onChange={() => {}}
        title="Time in local timezone"
        type="text"
        value={printDateAndTime(dateValue, {showTimezone: true, timezone})}
      />
    </StorybookContainer>
  );
};

export const MultiselectFieldStory = () => {
  const [checkboxValue, setCheckboxValue] = useState(["Option3"]);
  return (
    <StorybookContainer>
      <Box width={300}>
        <Field
          helperText="Here's some help text"
          onChange={setCheckboxValue}
          options={[
            {label: "Option1", value: "Option1"},
            {label: "Option2", value: "Option2"},
            {label: "Option3", value: "Option3"},
          ]}
          title="Multiselect Field"
          type="multiselect"
          value={checkboxValue}
        />
      </Box>
    </StorybookContainer>
  );
};

export const AddressFieldStory = () => {
  const [value, setValue] = useState<AddressInterface>({
    address1: "123 Main St",
    address2: "Apt 1",
    city: "San Francisco",
    state: "CA",
    zipcode: "94105",
  });

  const [secondValue, setSecondValue] = useState<AddressInterface>({
    address1: "456 Main St",
    address2: "",
    city: "San Francisco",
    state: "CA",
    zipcode: "94105",
  });

  const [thirdVal, setThirdVal] = useState<AddressInterface>({
    address1: "789 Main St",
    address2: "",
    city: "San Francisco",
    countyCode: "00000",
    countyName: "San Francisco",
    state: "CA",
    zipcode: "94105",
  });

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");

  return (
    <StorybookContainer>
      <Box width={300}>
        <Field
          helperText="Address Fields Helper Text"
          onChange={setValue}
          title="Address Field"
          type="address"
          value={value}
        />
        <TapToEdit
          isEditing={false}
          onSave={setValue}
          setValue={setValue}
          title="Address"
          type="address"
          value={value}
        />
        <Box paddingY={2} />
        <Heading>Auto Complete </Heading>
        <Field
          helperText="Test Your API Key Here"
          onChange={setGoogleMapsApiKey}
          title="Google Maps API Key"
          type="text"
          value={googleMapsApiKey}
        />
        <Heading size="sm">Without County</Heading>
        <Field
          googleMapsApiKey={googleMapsApiKey}
          onChange={setSecondValue}
          title="Address Field"
          type="address"
          value={secondValue}
        />
        <TapToEdit
          googleMapsApiKey={googleMapsApiKey}
          isEditing={false}
          onSave={setSecondValue}
          setValue={setSecondValue}
          title="Address"
          type="address"
          value={secondValue}
        />
        <Box padding={2} />
        <Heading size="sm">With County</Heading>
        <Field
          googleMapsApiKey={googleMapsApiKey}
          includeCounty
          onChange={setThirdVal}
          title="Address Field"
          type="address"
          value={thirdVal}
        />
        <TapToEdit
          googleMapsApiKey={googleMapsApiKey}
          includeCounty
          isEditing={false}
          onSave={setThirdVal}
          setValue={setThirdVal}
          title="Address"
          type="address"
          value={thirdVal}
        />
      </Box>
    </StorybookContainer>
  );
};

export const CustomSelectFieldStory = () => {
  const [value1, setValue1] = useState<string | undefined>("they/them/theirs");
  const [value2, setValue2] = useState<string | undefined>("they/them/theirs");
  return (
    <StorybookContainer>
      <Box width={300}>
        <Field
          helperText="Helper text goes here"
          onChange={setValue1}
          options={[
            {label: "she/her/hers", value: "she/her/hers"},
            {label: "he/him/his", value: "he/him/his"},
            {label: "they/them/theirs", value: "they/them/theirs"},
          ]}
          placeholder="None selected"
          title="Custom Select Field With Placeholder"
          type="customSelect"
          value={value1}
        />
      </Box>
      <Box width={300}>
        <Field
          helperText="Helper text goes here"
          onChange={setValue2}
          options={[
            {label: "she/her/hers", value: "she/her/hers"},
            {label: "he/him/his", value: "he/him/his"},
            {label: "they/them/theirs", value: "they/them/theirs"},
          ]}
          title="Custom Select Field Without Placeholder"
          type="customSelect"
          value={value2}
        />
      </Box>
    </StorybookContainer>
  );
};

interface SignatureFieldProps {
  setScrollEnabled: (scrollEnabled: boolean) => void;
}

export const SignatureFieldStory = ({setScrollEnabled}: SignatureFieldProps) => {
  const [signature, setValue] = useState("");
  return (
    <StorybookContainer>
      <Field
        onChange={setValue}
        onEnd={() => setScrollEnabled(true)}
        onStart={() => setScrollEnabled(false)}
        title="Signature Field"
        type="signature"
      />
      <Image
        resizeMode="contain"
        source={{uri: signature}}
        style={{
          borderColor: "black",
          borderWidth: 1,
          height: 80,
          width: 300,
        }}
      />
    </StorybookContainer>
  );
};
