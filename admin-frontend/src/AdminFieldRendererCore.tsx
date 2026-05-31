import {
  BooleanField,
  DateTimeField,
  MarkdownEditorField,
  SelectField,
  TextField,
} from "@terreno/ui";
import startCase from "lodash/startCase";
import React from "react";
import {AdminPrimitiveArrayField} from "./AdminPrimitiveArrayField";
import {AdminRefField} from "./AdminRefField";
import {CheckboxListEditor} from "./CheckboxListEditor";
import {LocaleContentEditor} from "./LocaleContentEditor";
import type {AdminFieldConfig, AdminFieldValue, AdminScreenProps, RefRendererMap} from "./types";

// Attempts to parse a string as JSON, returning the parsed value or the raw string
const parseJsonValue = (text: string): AdminFieldValue => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

// Serializes any value to a display string for the JSON editor
const serializeJsonValue = (val: AdminFieldValue): string => {
  if (val == null) {
    return "";
  }
  if (typeof val === "string") {
    return val;
  }
  return JSON.stringify(val, null, 2);
};

export interface AdminFieldRendererCoreProps extends AdminScreenProps {
  fieldKey: string;
  fieldConfig: AdminFieldConfig;
  value: AdminFieldValue;
  onChange: (value: AdminFieldValue) => void;
  errorText?: string;
  modelConfigs?: Array<{name: string; routePath: string}>;
  /** Parent document form state, used to derive dynamic options for sub-fields */
  parentFormState?: Record<string, AdminFieldValue>;
  /**
   * Optional map of custom ref-field renderers keyed by referenced model name.
   * Forwarded to {@link AdminPrimitiveArrayField} so nested fields participate in the override.
   */
  refRenderers?: RefRendererMap;
}

/**
 * Renders admin form fields for all types except arrays of sub-documents.
 * Nested sub-document arrays are handled by {@link AdminNestedArrayField} via
 * {@link AdminFieldRenderer} to avoid a circular import.
 */
export const AdminFieldRendererCore: React.FC<AdminFieldRendererCoreProps> = ({
  fieldKey,
  fieldConfig,
  value,
  onChange,
  errorText,
  baseUrl,
  apiBase,
  routeBase,
  api,
  modelConfigs,
  parentFormState,
  refRenderers,
}) => {
  const label = startCase(fieldKey);
  const helperText = fieldConfig.description;

  // Dynamic enum: look for a sibling array field whose items have a `key` property.
  if (!fieldConfig.enum && parentFormState && fieldConfig.type === "string") {
    const pluralKey = `${fieldKey}s`;
    const siblingArray = parentFormState[pluralKey];
    if (Array.isArray(siblingArray) && siblingArray.length > 0 && siblingArray[0]?.key != null) {
      const dynamicOptions = (siblingArray as Array<{key?: string}>)
        .map((item) => item.key)
        .filter(Boolean)
        .map((k) => ({label: k as string, value: k as string}));
      if (dynamicOptions.length > 0) {
        return (
          <SelectField
            errorText={errorText}
            helperText={helperText}
            onChange={onChange}
            options={dynamicOptions}
            title={label}
            value={typeof value === "string" ? value : ""}
          />
        );
      }
    }
  }

  // ObjectId with ref -> reference field (skip arrays — those go to AdminPrimitiveArrayField)
  if (fieldConfig.ref && fieldConfig.type !== "array") {
    const CustomRenderer = refRenderers?.[fieldConfig.ref];
    const refModel = modelConfigs?.find((m) => m.name === fieldConfig.ref);
    if (CustomRenderer) {
      return (
        <CustomRenderer
          api={api}
          apiBase={apiBase}
          baseUrl={baseUrl}
          errorText={errorText}
          helperText={helperText}
          onChange={onChange}
          refModelName={fieldConfig.ref}
          routeBase={routeBase}
          routePath={refModel?.routePath ?? ""}
          title={label}
          value={typeof value === "string" ? value : ""}
        />
      );
    }
    if (refModel) {
      return (
        <AdminRefField
          api={api}
          apiBase={apiBase}
          baseUrl={baseUrl}
          errorText={errorText}
          helperText={helperText}
          onChange={onChange}
          refModelName={fieldConfig.ref}
          routeBase={routeBase}
          routePath={refModel.routePath}
          title={label}
          value={typeof value === "string" ? value : ""}
        />
      );
    }
  }

  if (fieldConfig.type === "boolean") {
    return (
      <BooleanField
        errorText={errorText}
        helperText={helperText}
        onChange={onChange}
        title={label}
        value={typeof value === "boolean" ? value : false}
      />
    );
  }

  if (fieldConfig.enum && fieldConfig.enum.length > 0) {
    const includesNullOption = fieldConfig.enum.some((enumValue) => enumValue == null);
    const enumOptions = fieldConfig.enum
      .filter((enumValue): enumValue is string => typeof enumValue === "string")
      .map((v: string) => ({label: startCase(v), value: v}));
    const options = includesNullOption ? [{label: "None", value: ""}, ...enumOptions] : enumOptions;
    return (
      <SelectField
        errorText={errorText}
        helperText={helperText}
        onChange={(nextValue: string) => onChange(nextValue === "" ? undefined : nextValue)}
        options={options}
        title={label}
        value={typeof value === "string" ? value : ""}
      />
    );
  }

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
        value={typeof value === "string" ? value : ""}
      />
    );
  }

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

  if (fieldConfig.widget === "locale-content") {
    const localeValue =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, string>)
        : {};
    return (
      <LocaleContentEditor
        errorText={errorText}
        helperText={helperText}
        onChange={onChange}
        title={label}
        value={localeValue}
      />
    );
  }

  if (fieldConfig.widget === "locale-default") {
    const contentMap = parentFormState?.content;
    const localeKeys =
      contentMap && typeof contentMap === "object" && !Array.isArray(contentMap)
        ? Object.keys(contentMap)
        : [];
    const hasLocales = localeKeys.length > 0;
    const options = localeKeys.map((k) => ({label: k.toUpperCase(), value: k}));
    return (
      <SelectField
        disabled={!hasLocales}
        errorText={errorText}
        helperText={
          hasLocales
            ? helperText
            : "Add at least one locale with content before setting a default locale."
        }
        onChange={onChange}
        options={options}
        title={label}
        value={typeof value === "string" ? value : ""}
      />
    );
  }

  if (fieldConfig.type === "object" || fieldConfig.type === "mixed") {
    const displayValue = serializeJsonValue(value);
    return (
      <TextField
        errorText={errorText}
        helperText={helperText ?? "JSON value (string, number, boolean, object, or array)"}
        onChange={(text: string) => {
          onChange(parseJsonValue(text));
        }}
        testID={`admin-field-${fieldKey}`}
        title={label}
        value={displayValue}
      />
    );
  }

  if (fieldConfig.type === "array" && fieldConfig.itemType && !fieldConfig.items) {
    return (
      <AdminPrimitiveArrayField
        api={api}
        apiBase={apiBase}
        baseUrl={baseUrl}
        errorText={errorText}
        helperText={helperText}
        itemEnum={fieldConfig.itemEnum}
        itemRef={fieldConfig.itemRef}
        itemType={fieldConfig.itemType}
        modelConfigs={modelConfigs}
        onChange={onChange}
        refRenderers={refRenderers}
        routeBase={routeBase}
        title={label}
        value={Array.isArray(value) ? value : []}
      />
    );
  }

  if (fieldConfig.type === "array") {
    const jsonValue =
      value != null ? (typeof value === "string" ? value : JSON.stringify(value, null, 2)) : "[]";
    return (
      <TextField
        errorText={errorText}
        grow
        helperText={helperText ?? "Enter valid JSON array"}
        multiline
        onChange={(text: string) => {
          try {
            onChange(JSON.parse(text));
          } catch {
            onChange(text);
          }
        }}
        rows={4}
        testID={`admin-field-${fieldKey}`}
        title={label}
        value={jsonValue}
      />
    );
  }

  if (fieldConfig.widget === "markdown") {
    return (
      <MarkdownEditorField
        errorText={errorText}
        helperText={helperText}
        onChange={onChange}
        testID={`admin-field-${fieldKey}`}
        title={label}
        value={typeof value === "string" ? value : ""}
      />
    );
  }

  if (fieldConfig.widget === "checkbox-list") {
    return (
      <CheckboxListEditor
        errorText={errorText}
        helperText={helperText}
        onChange={onChange}
        title={label}
        value={
          Array.isArray(value)
            ? (value as React.ComponentProps<typeof CheckboxListEditor>["value"])
            : []
        }
      />
    );
  }

  if (fieldConfig.widget === "textarea") {
    return (
      <TextField
        errorText={errorText}
        grow
        helperText={helperText}
        multiline
        onChange={onChange}
        rows={6}
        testID={`admin-field-${fieldKey}`}
        title={label}
        value={typeof value === "string" ? value : ""}
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
      value={typeof value === "string" ? value : ""}
    />
  );
};
