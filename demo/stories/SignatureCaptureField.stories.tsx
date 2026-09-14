import {SignatureCaptureField, type SignatureCaptureValue} from "@terreno/ui";
import {type ReactElement, useState} from "react";

export const SignatureCaptureFieldDemo = (): ReactElement => {
  const [value, setValue] = useState<SignatureCaptureValue>();
  return <SignatureCaptureField onChange={setValue} value={value} />;
};

export const SignatureCaptureFieldDemoDrawFirst = (): ReactElement => {
  const [value, setValue] = useState<SignatureCaptureValue>();
  return <SignatureCaptureField defaultMode="draw" onChange={setValue} value={value} />;
};

export const SignatureCaptureFieldDemoWithError = (): ReactElement => {
  const [value, setValue] = useState<SignatureCaptureValue>();
  return (
    <SignatureCaptureField
      errorText="A signature is required."
      helperText="Your signature will be printed on all notes going forward."
      onChange={setValue}
      value={value}
    />
  );
};

export const SignatureCaptureFieldDemoDisabled = (): ReactElement => {
  const [value, setValue] = useState<SignatureCaptureValue>({
    fontKey: "dancing-script",
    mode: "type",
    typedName: "Jane Doe",
  });
  return <SignatureCaptureField disabled onChange={setValue} value={value} />;
};
