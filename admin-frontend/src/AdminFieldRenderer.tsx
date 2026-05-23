import startCase from "lodash/startCase";
import React from "react";
import {AdminFieldRendererCore, type AdminFieldRendererCoreProps} from "./AdminFieldRendererCore";
import {AdminNestedArrayField} from "./AdminNestedArrayField";

export type AdminFieldRendererProps = AdminFieldRendererCoreProps;

/**
 * Renders an appropriate input field for a given model field in the admin form.
 *
 * Delegates arrays of sub-documents to {@link AdminNestedArrayField}; all other
 * field types are rendered by {@link AdminFieldRendererCore}, which maps field
 * types to the correct UI component:
 * - `boolean` → BooleanField
 * - `number` → TextField with number validation
 * - `date`/`datetime` → DateTimeField
 * - `enum` → SelectField with enum values as options
 * - ObjectId with `ref` → AdminRefField (select from referenced model)
 * - Default → TextField
 *
 * The split between this wrapper and {@link AdminFieldRendererCore} breaks the
 * require cycle that would otherwise exist between this file and
 * {@link AdminNestedArrayField}.
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
 * @see AdminFieldRendererCore for supported field type mappings
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
  // Array of sub-documents — dispatch to AdminNestedArrayField (which avoids the
  // require cycle by importing AdminFieldRendererCore for its leaf fields).
  if (fieldConfig.type === "array" && fieldConfig.items) {
    return (
      <AdminNestedArrayField
        api={api}
        baseUrl={baseUrl}
        errorText={errorText}
        helperText={fieldConfig.description}
        items={fieldConfig.items}
        modelConfigs={modelConfigs}
        onChange={onChange as (value: Record<string, unknown>[]) => void}
        parentFormState={parentFormState}
        refRenderers={refRenderers}
        title={startCase(fieldKey)}
        value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
      />
    );
  }

  return (
    <AdminFieldRendererCore
      api={api}
      baseUrl={baseUrl}
      errorText={errorText}
      fieldConfig={fieldConfig}
      fieldKey={fieldKey}
      modelConfigs={modelConfigs}
      onChange={onChange}
      parentFormState={parentFormState}
      refRenderers={refRenderers}
      value={value}
    />
  );
};
