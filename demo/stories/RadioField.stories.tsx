import {Box, RadioField, type RadioFieldProps} from "@terreno/ui";
import React from "react";

export const RadioFieldDemo = (props: Partial<RadioFieldProps>): React.ReactElement => {
  const [selectedOption, setSelectedOption] = React.useState("Option 1");
  return (
    <Box style={{width: 200}}>
      <RadioField
        onChange={setSelectedOption}
        options={[
          {label: "Option 1", value: "Option 1"},
          {label: "Option 2", value: "Option 2"},
          {label: "Option 3", value: "Option 3"},
        ]}
        title="Sample Radio Fields"
        value={selectedOption}
        {...props}
      />
    </Box>
  );
};

export const RadioFieldsLeftText = (): React.ReactElement => {
  const [selectedOption, setSelectedOption] = React.useState("Option 1");

  return (
    <Box style={{paddingVertical: 10, width: 200}}>
      <RadioField
        onChange={setSelectedOption}
        options={[
          {label: "Option 1", value: "Option 1"},
          {label: "Option 2", value: "Option 2"},
          {label: "Option 3", value: "Option 3"},
        ]}
        title="Sample Radio Fields - Left"
        value={selectedOption}
        variant="leftText"
      />
    </Box>
  );
};

export const RadioFieldsRightText = (): React.ReactElement => {
  const [selectedOption, setSelectedOption] = React.useState("Option 1");

  return (
    <Box style={{paddingVertical: 10, width: 200}}>
      <RadioField
        onChange={setSelectedOption}
        options={[
          {label: "Option 1", value: "Option 1"},
          {label: "Option 2", value: "Option 2"},
          {label: "Option 3", value: "Option 3"},
        ]}
        title="Sample Radio Fields - Right"
        value={selectedOption}
        variant="rightText"
      />
    </Box>
  );
};
