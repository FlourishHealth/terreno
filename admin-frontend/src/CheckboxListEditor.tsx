import {BooleanField, Box, Button, IconButton, Text, TextField} from "@terreno/ui";
import React, {useCallback} from "react";

interface CheckboxItem {
  label: string;
  required: boolean;
  confirmationPrompt?: string;
}

interface CheckboxListEditorProps {
  value: CheckboxItem[];
  onChange: (value: CheckboxItem[]) => void;
  title?: string;
  helperText?: string;
  errorText?: string;
}

export const CheckboxListEditor: React.FC<CheckboxListEditorProps> = ({
  value = [],
  onChange,
  title,
  helperText,
  errorText,
}) => {
  const items: CheckboxItem[] = Array.isArray(value) ? value : [];

  const handleAdd = useCallback(() => {
    onChange([...items, {label: "", required: false}]);
  }, [items, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange]
  );

  const handleUpdate = useCallback(
    (index: number, field: keyof CheckboxItem, fieldValue: string | boolean) => {
      const updated = items.map((item, i) => (i === index ? {...item, [field]: fieldValue} : item));
      onChange(updated);
    },
    [items, onChange]
  );

  return (
    <Box gap={2}>
      {title && (
        <Text bold size="md">
          {title}
        </Text>
      )}
      {helperText && (
        <Text color="secondaryDark" size="sm">
          {helperText}
        </Text>
      )}
      {items.map((item, index) => (
        <Box border="default" gap={2} key={`checkbox-${index}`} padding={3} rounding="md">
          <Box alignItems="center" direction="row" justifyContent="between">
            <Text bold size="sm">
              Checkbox {index + 1}
            </Text>
            <IconButton
              accessibilityLabel="Remove checkbox"
              iconName="trash"
              onClick={() => handleRemove(index)}
              testID={`checkbox-remove-${index}`}
              variant="destructive"
            />
          </Box>
          <TextField
            onChange={(val: string) => handleUpdate(index, "label", val)}
            placeholder="Checkbox label"
            testID={`checkbox-label-${index}`}
            title="Label"
            value={item.label}
          />
          <BooleanField
            onChange={(val: boolean) => handleUpdate(index, "required", val)}
            title="Required"
            value={item.required}
          />
          <TextField
            onChange={(val: string) => handleUpdate(index, "confirmationPrompt", val)}
            placeholder="Optional confirmation prompt"
            testID={`checkbox-prompt-${index}`}
            title="Confirmation Prompt"
            value={item.confirmationPrompt ?? ""}
          />
        </Box>
      ))}
      <Button
        iconName="plus"
        onClick={handleAdd}
        testID="checkbox-add-button"
        text="Add Checkbox"
        variant="outline"
      />
      {errorText && (
        <Text color="error" size="sm">
          {errorText}
        </Text>
      )}
    </Box>
  );
};
