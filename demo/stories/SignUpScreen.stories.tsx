import {Box, SignUpScreen} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";

const fields = [
  {label: "Email", name: "email", required: true, type: "email" as const},
  {label: "Password", name: "password", required: true, type: "password" as const},
];

export const SignUpScreenDemo: React.FC = (): React.ReactElement => {
  const onSubmit = useCallback(async (): Promise<void> => {}, []);
  return (
    <Box>
      <SignUpScreen fields={fields} onSubmit={onSubmit} />
    </Box>
  );
};

export const SignUpScreenWithOauth: React.FC = (): React.ReactElement => {
  const onSubmit = useCallback(async (): Promise<void> => {}, []);
  const onPress = useCallback(async (): Promise<void> => {}, []);
  return (
    <Box>
      <SignUpScreen
        fields={fields}
        oauthProviders={[{onPress, provider: "google"}]}
        onSubmit={onSubmit}
      />
    </Box>
  );
};
