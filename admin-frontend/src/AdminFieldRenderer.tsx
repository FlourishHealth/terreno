import {
  BooleanField,
  DateTimeField,
  MarkdownEditorField,
  SelectField,
  TextField,
} from "@terreno/ui";
import startCase from "lodash/startCase";
import React from "react";
import {AdminNestedArrayField} from "./AdminNestedArrayField";
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

interface AdminFieldRendererProps extends AdminScreenProps {
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
   * When `fieldConfig.ref` (single ref) or `fieldConfig.itemRef` (primitive array
   * of refs) matches a key, the custom component renders in place of the built-in
   * {@link AdminRefField}. Forwarded to {@link AdminNestedArrayField} and
   * {@link AdminPrimitiveArrayField} so nested fields participate in the override.
   */
  refRenderers?: RefRendererMap;
}

/**
 * Renders an appropriate input field for a given model field in the admin form.
 *
 * Maps field types to the correct UI component:
 * - `boolean` → BooleanField
 * - `number` → TextField with number validation
 * - `date`/`datetime` → DateTimeField
 * - `enum` → SelectField with enum values as options
 * - ObjectId with `ref` → AdminRefField (select from referenced model)
 * - Default → TextField
 *
 * @param props - Component props
 * @param props.fieldKey - The field key/name in the model
 * @param props.fieldConfig - Field configuration metadata from backend
 * @param props.value - Current field value
 * @param props.onChange - Callback when field value changes
 * @param props.errorText - Optional validation error message
 * @param props.baseUrl - Base URL for admin routes
 * @param props.api - RTK Query API instance
 * @param props.modelConfigs - Available model configurations for reference field lookups
 *
 * @example
 * ```typescript
 * <AdminFieldRenderer
 *   fieldKey="status"
 *   fieldConfig={{type: "string", required: true, enum: ["active", "inactive"]}}
 *   value={formState.status}
 *   onChange={(val) => setFormState({...formState, status: val})}
 *   baseUrl="/admin"
 *   api={api}
 * />
 * ```
 *
 * @see AdminRefField for reference field rendering
 * @see AdminModelForm for form usage
 */
export const AdminFieldRenderer: React.FC<AdminFieldRendererProps> = ({
  fieldKey,
  fieldConfig,
  value,
  onChange,
  errorText,
  baseUrl,
  api,
  modelConfigs,
  parentFormState,
  refRenderers,
}) => {
  const label = startCase(fieldKey);
  const helperText = fieldConfig.description;

  // Dynamic enum: look for a sibling array field whose items have a `key` property.
  // E.g. sub-field "variant" → parent field "variants" → extract key values as options.
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
          baseUrl={baseUrl}
          errorText={errorText}
          helperText={helperText}
          onChange={onChange}
          refModelName={fieldConfig.ref}
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
          baseUrl={baseUrl}
          errorText={errorText}
          helperText={helperText}
          onChange={onChange}
          refModelName={fieldConfig.ref}
          routePath={refModel.routePath}
          title={label}
          value={typeof value === "string" ? value : ""}
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
        value={typeof value === "boolean" ? value : false}
      />
    );
  }

  // Enum -> SelectField
  if (fieldConfig.enum && fieldConfig.enum.length > 0) {
    const includesNullOption = fieldConfig.enum.some((v) => v == null);
    const enumOptions = fieldConfig.enum
      .filter((v): v is string => typeof v === "string")
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
        value={typeof value === "string" ? value : ""}
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

  // Locale content widget (Map<locale, markdown>)
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

  // Locale default widget — dropdown populated from sibling content field's locale keys
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

  // Mixed / object type — JSON-aware single-line field for schemaless fields (e.g., Mongoose Mixed)
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

  // Array of primitives (string, number, boolean) or ObjectId refs
  if (fieldConfig.type === "array" && fieldConfig.itemType && !fieldConfig.items) {
    return (
      <AdminPrimitiveArrayField
        api={api}
        baseUrl={baseUrl}
        errorText={errorText}
        helperText={helperText}
        itemEnum={fieldConfig.itemEnum}
        itemRef={fieldConfig.itemRef}
        itemType={fieldConfig.itemType}
        modelConfigs={modelConfigs}
        onChange={onChange}
        refRenderers={refRenderers}
        title={label}
        value={Array.isArray(value) ? value : []}
      />
    );
  }

  // Array of sub-documents
  if (fieldConfig.type === "array" && fieldConfig.items) {
    return (
      <AdminNestedArrayField
        api={api}
        baseUrl={baseUrl}
        errorText={errorText}
        helperText={helperText}
        items={fieldConfig.items}
        modelConfigs={modelConfigs}
        onChange={onChange}
        parentFormState={parentFormState}
        refRenderers={refRenderers}
        title={label}
        value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
      />
    );
  }

  // Array without item metadata — show as JSON text
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

  // Markdown widget
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

  // Checkbox list widget
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

  // Textarea widget
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
