# Form Generation

Create a form component with the following specifications:

## Form Details
- **Name**: {{name}}Form
- **Purpose**: {{purpose}}

## Fields
{{fieldsList}}

## Implementation Requirements

### Component Structure
```tsx
import {Box, Button, TextField, SelectField} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

interface {{Name}}FormProps {
  initialValues?: Partial<{{Name}}FormValues>;
  onSubmit: (values: {{Name}}FormValues) => Promise<void>;
  isLoading?: boolean;
}

interface {{Name}}FormValues {
  {{fieldsInterface}}
}

export const {{Name}}Form: React.FC<{{Name}}FormProps> = ({
  initialValues,
  onSubmit,
  isLoading,
}) => {
  {{stateDeclarations}}
  {{errorStates}}

  const validate = useCallback((): boolean => {
    let isValid = true;
    {{validationLogic}}
    return isValid;
  }, [{{dependencies}}]);

  const handleSubmit = useCallback(async (): Promise<void> => {
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
        text="Submit"
        onClick={handleSubmit}
        loading={isLoading}
        disabled={isLoading}
        fullWidth
      />
    </Box>
  );
};
```

### Validation
- Validate required fields
- Show inline error messages
- Disable submit while loading

### Field Types
- **text**: Use `TextField`
- **email**: Use `TextField` with `type="email"`
- **password**: Use `TextField` with `type="password"`
- **number**: Use `TextField` with `type="number"`
- **select**: Use `SelectField` with options
- **date**: Use `DateTimeField`
- **checkbox**: Use `CheckBox`

### Integration
- Import and use in screen components
- Pass mutation function as `onSubmit`
- Handle success/error states in parent
