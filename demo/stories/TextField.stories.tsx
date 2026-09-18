import {TextField} from "@terreno/ui";
import {type ReactElement, useState} from "react";

export const TextFieldDemo = (): ReactElement => {
  const [value, setValue] = useState("");
  return (
    <TextField
      onChange={(v) => setValue(v)}
      placeholder="This is placeholder text."
      value={value}
    />
  );
};

export const TextFieldWithLabelDemo = (): ReactElement => {
  const [value, setValue] = useState("");
  return (
    <TextField
      onChange={(v) => setValue(v)}
      placeholder="This is placeholder text."
      title="Form field title"
      value={value}
    />
  );
};

export const TextFieldWithHelperTextDemo = (): ReactElement => {
  const [value, setValue] = useState("");
  return (
    <TextField
      helperText="Helpful information for filling out the form field."
      onChange={(v) => setValue(v)}
      placeholder="This is placeholder text."
      testID="demo-text-field"
      title="Form field title"
      value={value}
    />
  );
};

export const TextFieldWithErrorMsgDemo = (): ReactElement => {
  const [value, setValue] = useState("");
  return (
    <TextField
      errorText="Provide actionable information"
      helperText="Helpful information for filling out the form field."
      onChange={(v) => setValue(v)}
      placeholder="This is placeholder text."
      title="Enter some text"
      value={value}
    />
  );
};

export const TextFieldPasswordDemo = (): ReactElement => {
  const [value, setValue] = useState("Passwordlol:P");
  return (
    <TextField
      helperText="Press the eye to show or hide what you typed."
      onChange={(v) => setValue(v)}
      testID="demo-password-field"
      title="Password"
      type="password"
      value={value}
    />
  );
};

export const TextFieldPasswordNoToggleDemo = (): ReactElement => {
  const [value, setValue] = useState("Passwordlol:P");
  return (
    <TextField
      helperText="The value can never be revealed here."
      onChange={(v) => setValue(v)}
      showVisibilityToggle={false}
      title="Password"
      type="password"
      value={value}
    />
  );
};

export const TextFieldDisabledDemo = (): ReactElement => {
  const [value, setValue] = useState("");
  return (
    <TextField
      disabled
      helperText="Tell the user why this is disabled."
      onChange={(v) => {
        setValue(v);
      }}
      placeholder="This is placeholder text."
      title="Form field title"
      value={value}
    />
  );
};
