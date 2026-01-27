import {HeightField, Text} from "@terreno/ui";
import {type ReactElement, useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

export const HeightFieldDemo = (): ReactElement => {
  const [value, setValue] = useState<string | undefined>("");
  return (
    <StorybookContainer>
      <HeightField onChange={setValue} title="Height" value={value} />
      <Text>Value: {value || "(empty)"}</Text>
    </StorybookContainer>
  );
};

export const HeightFieldWithValueDemo = (): ReactElement => {
  // 70 inches = 5 feet 10 inches
  const [value, setValue] = useState<string | undefined>("70");
  return (
    <StorybookContainer>
      <HeightField onChange={setValue} title="Height" value={value} />
      <Text>Value: {value || "(empty)"}</Text>
    </StorybookContainer>
  );
};

export const HeightFieldWithHelperTextDemo = (): ReactElement => {
  const [value, setValue] = useState<string | undefined>("");
  return (
    <StorybookContainer>
      <HeightField
        helperText="Enter your height in feet and inches"
        onChange={setValue}
        title="Height"
        value={value}
      />
      <Text>Value: {value || "(empty)"}</Text>
    </StorybookContainer>
  );
};

export const HeightFieldWithErrorDemo = (): ReactElement => {
  const [value, setValue] = useState<string | undefined>("");
  return (
    <StorybookContainer>
      <HeightField
        errorText="Height is required"
        onChange={setValue}
        title="Height"
        value={value}
      />
      <Text>Value: {value || "(empty)"}</Text>
    </StorybookContainer>
  );
};

export const HeightFieldRequiredDemo = (): ReactElement => {
  const [value, setValue] = useState<string | undefined>("");
  const showError = !value || value === "0";
  return (
    <StorybookContainer>
      <HeightField
        errorText={showError ? "Height is required" : undefined}
        onChange={setValue}
        title="Height *"
        value={value}
      />
      <Text>Value: {value || "(empty)"}</Text>
    </StorybookContainer>
  );
};

export const HeightFieldDisabledDemo = (): ReactElement => {
  const [value, setValue] = useState<string | undefined>("72");
  return (
    <StorybookContainer>
      <HeightField
        disabled
        helperText="This field is disabled"
        onChange={setValue}
        title="Height"
        value={value}
      />
      <Text>Value: {value || "(empty)"}</Text>
    </StorybookContainer>
  );
};
