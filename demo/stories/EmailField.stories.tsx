import {Box, EmailField, Text} from "ferns-ui";
import {type ReactElement, useState} from "react";

export const EmailFieldDemo = (): ReactElement => {
  const [value, setValue] = useState("dwight@example.com");
  return (
    <>
      <EmailField
        onChange={(v: string) => setValue(v)}
        placeholder="Enter an email address"
        title="Email"
        value={value}
      />
      <Box marginTop={2}>
        <Text>We only return correct email address back to the parent component.</Text>
        <Text>Returned Value: {value}</Text>
      </Box>
    </>
  );
};
