import {TypedSignatureField, type TypedSignatureValue} from "@terreno/ui";
import {type ReactElement, useState} from "react";

export const TypedSignatureFieldDemo = (): ReactElement => {
  const [value, setValue] = useState<TypedSignatureValue>();
  return <TypedSignatureField onChange={setValue} value={value} />;
};

export const TypedSignatureFieldDemoPrefilled = (): ReactElement => {
  const [value, setValue] = useState<TypedSignatureValue>({
    fontKey: "great-vibes",
    typedName: "Jane Doe",
  });
  return <TypedSignatureField onChange={setValue} value={value} />;
};

export const TypedSignatureFieldDemoWithError = (): ReactElement => {
  const [value, setValue] = useState<TypedSignatureValue>();
  return (
    <TypedSignatureField
      errorText="A signature is required."
      helperText="Your signature will be printed on all notes going forward."
      onChange={setValue}
      value={value}
    />
  );
};

export const TypedSignatureFieldDemoDisabled = (): ReactElement => {
  const [value, setValue] = useState<TypedSignatureValue>({
    fontKey: "dancing-script",
    typedName: "Jane Doe",
  });
  return <TypedSignatureField disabled onChange={setValue} value={value} />;
};
