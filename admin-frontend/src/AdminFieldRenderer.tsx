import {BooleanField, DateTimeField, SelectField, TextField} from "@terreno/ui";
import startCase from "lodash/startCase";
import React from "react";
import {AdminRefField} from "./AdminRefField";
import type {AdminFieldConfig, AdminScreenProps} from "./types";

interface AdminFieldRendererProps extends AdminScreenProps {
  fieldKey: string;
  fieldConfig: AdminFieldConfig;
  value: any;
  onChange: (value: any) => void;
  errorText?: string;
  modelConfigs?: Array<{name: string; routePath: string}>;
}

export const AdminFieldRenderer: React.FC<AdminFieldRendererProps> = ({
  fieldKey,
  fieldConfig,
  value,
  onChange,
  errorText,
  baseUrl,
  api,
  modelConfigs,
}) => {
  const label = startCase(fieldKey);
  const helperText = fieldConfig.description;

  // ObjectId with ref -> reference field
  if (fieldConfig.ref && modelConfigs) {
    const refModel = modelConfigs.find((m) => m.name === fieldConfig.ref);
    if (refModel) {
      return (
        <AdminRefField
          api={api}
          baseUrl={baseUrl}
          errorText={errorText}
          helperText={helperText}
          onChange={onChange}
          refModelName={fieldConfig.ref}
          routePath={refModel.routePath}
          title={label}
          value={value ?? ""}
        />
      );
    }
  }

  // Boolean
  if (fieldConfig.type === "boolean") {
    return (
      <BooleanField
        errorText={errorText}
        helperText={helperText}
        onChange={onChange}
        title={label}
        value={value ?? false}
      />
    );
  }

  // Enum -> SelectField
  if (fieldConfig.enum && fieldConfig.enum.length > 0) {
    const options = fieldConfig.enum.map((v: string) => ({label: startCase(v), value: v}));
    return (
      <SelectField
        errorText={errorText}
        helperText={helperText}
        onChange={onChange}
        options={options}
        title={label}
        value={value ?? ""}
      />
    );
  }

  // Date/datetime
  if (
    fieldConfig.type === "date" ||
    fieldConfig.type === "datetime" ||
    (fieldConfig.type === "string" && fieldKey.toLowerCase().includes("date"))
  ) {
    return (
      <DateTimeField
        errorText={errorText}
        helperText={helperText}
        onChange={onChange}
        testID={`admin-field-${fieldKey}`}
        title={label}
        type="datetime"
        value={value ?? ""}
      />
    );
  }

  // Number
  if (fieldConfig.type === "number") {
    return (
      <TextField
        errorText={errorText}
        helperText={helperText}
        onChange={(text: string) => {
          const num = Number(text);
          onChange(Number.isNaN(num) ? text : num);
        }}
        testID={`admin-field-${fieldKey}`}
        title={label}
        value={value != null ? String(value) : ""}
      />
    );
  }

  // Default: string -> TextField
  return (
    <TextField
      errorText={errorText}
      helperText={helperText}
      onChange={onChange}
      testID={`admin-field-${fieldKey}`}
      title={label}
      value={value ?? ""}
    />
  );
};
