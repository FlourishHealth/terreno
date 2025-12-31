import {TextArea} from "ferns-ui";
import type React from "react";

import {StorybookContainer} from "./StorybookContainer";

export const TextAreas = (): React.ReactElement => {
  return (
    <StorybookContainer>
      <TextArea id="none" onChange={() => {}} placeholder="Here's some placeholder text." />
    </StorybookContainer>
  );
};
export const WithLabelTextArea = (): React.ReactElement => {
  return (
    <StorybookContainer>
      <TextArea
        helperText="And some subtext"
        id="none"
        onChange={() => {}}
        title="Enter a bunch of text"
      />
    </StorybookContainer>
  );
};
export const TextAreaDisabled = (): React.ReactElement => {
  return (
    <StorybookContainer>
      <TextArea disabled id="none" onChange={() => {}} placeholder="This is disabled" />
    </StorybookContainer>
  );
};
export const TextAreaErrored = (): React.ReactElement => {
  return (
    <StorybookContainer>
      <TextArea
        errorText="There's been an error"
        helperText="And some subtext"
        id="none"
        onChange={() => {}}
        title="Enter a bunch of text"
      />
    </StorybookContainer>
  );
};
