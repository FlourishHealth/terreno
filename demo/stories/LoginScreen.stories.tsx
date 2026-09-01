import {LoginScreen} from "@terreno/ui";
import {type ReactElement, useCallback} from "react";

const fields = [
  {label: "Email", name: "email", required: true, type: "email" as const},
  {label: "Password", name: "password", required: true, type: "password" as const},
];

export const LoginScreenDemo: React.FC = (): ReactElement => {
  const handleSubmit = useCallback(async (): Promise<void> => {}, []);
  const handleForgotPassword = useCallback((): void => {}, []);

  return (
    <LoginScreen fields={fields} onForgotPassword={handleForgotPassword} onSubmit={handleSubmit} />
  );
};
