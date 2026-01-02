import {BooleanField, Text, useStoredState} from "@terreno/ui";
import type React from "react";
import {useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

export const BooleanFieldDemo = (): React.ReactElement => {
  const [value, setValue] = useState(true);
  return (
    <StorybookContainer>
      <BooleanField
        disabledHelperText="Here's some help text"
        onChange={setValue}
        title="Boolean field"
        value={value}
        variant="simple"
      />
    </StorybookContainer>
  );
};

export const BooleanFieldDisabledDemo = (): React.ReactElement => {
  const [value, setValue] = useState(true);
  return (
    <StorybookContainer>
      <BooleanField
        disabled
        disabledHelperText="Here's some help text"
        onChange={setValue}
        title="Boolean field"
        value={value}
      />
    </StorybookContainer>
  );
};

export const BooleanFieldWithTitleDemo = (): React.ReactElement => {
  const [value, setValue] = useState(true);
  return (
    <StorybookContainer>
      <BooleanField
        disabledHelperText="Here's some help text"
        onChange={setValue}
        title="Boolean field"
        value={value}
        variant="title"
      />
    </StorybookContainer>
  );
};

export const BooleanFieldDisabledWithTitleDemo = (): React.ReactElement => {
  const [value, setValue] = useState(true);
  return (
    <StorybookContainer>
      <BooleanField
        disabled
        disabledHelperText="Here's some help text"
        onChange={setValue}
        title="Boolean field"
        value={value}
        variant="title"
      />
    </StorybookContainer>
  );
};

export const BooleanFieldNoLabelDemo = (): React.ReactElement => {
  const [value, setValue] = useState(true);
  return (
    <StorybookContainer>
      <BooleanField onChange={setValue} value={value} variant="simple" />
    </StorybookContainer>
  );
};

export const BooleanFieldWithStoredStateDemo = (): React.ReactElement => {
  const [value, setValue, isLoading] = useStoredState<boolean>("booleanFieldDemo", false);

  if (isLoading) {
    return (
      <StorybookContainer>
        <Text>Loading...</Text>
      </StorybookContainer>
    );
  }

  return (
    <StorybookContainer>
      <BooleanField
        helperText="This value persists after page refresh. Try toggling it and refreshing the page!"
        onChange={(newValue) => {
          void setValue(newValue);
        }}
        title="Persistent Boolean Field"
        value={value ?? false}
        variant="title"
      />
    </StorybookContainer>
  );
};
