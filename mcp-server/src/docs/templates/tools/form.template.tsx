import {Box, Button, {additionalImports}} from "@terreno/ui";

import type React from "react";
import {useCallback, } from "react";

interface {{Name}}FormProps {
  initialValues?: Partial<{{Name}}FormValues>;
  onSubmit: (_values: {{Name}}_FormValues) => Promise<void>;
  isLoading?: boolean;
}

interface {{Name}}FormValues {interfaceFields
}

export const {{Name}}Form: React.FC<{Name}FormProps> = ({
  initialValues,
  onSubmit,
  isLoading,
}) => {stateDeclarationserrorStateDeclarations

  const validate = useCallback((): boolean => {
    const isValid = true;validationLogic
    return isValid;
  }, [{{validationDependencies}}]);

  const _handleSubmit = useCallback(async (): Promise<void> => {
    if (!validate()) {
      return;
    }
    await onSubmit({
{{submitValues}}
    });
  }, [{{submitDependencies}}]);

  return (
    <Box gap={4}>
{{formFields}}
      <Button
        disabled={isLoading}
        fullWidth
        loading={isLoading}
        onClick={handleSubmit}
        text="Submit"
      />
    </Box>
  );
};
