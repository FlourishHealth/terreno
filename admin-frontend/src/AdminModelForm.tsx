import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Button, Page, Spinner, Text, useToast} from "@terreno/ui";
import {router, useNavigation} from "expo-router";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {AdminFieldRenderer} from "./AdminFieldRenderer";
import type {AdminFieldConfig, AdminModelConfig} from "./types";
import {SYSTEM_FIELDS} from "./types";
import {useAdminApi} from "./useAdminApi";
import {useAdminConfig} from "./useAdminConfig";

interface AdminModelFormProps {
  baseUrl: string;
  api: Api<any, any, any, any>;
  modelName: string;
  mode: "create" | "edit";
  itemId?: string;
  footerContent?: React.ReactNode;
  transformPayload?: (params: {
    mode: "create" | "edit";
    payload: Record<string, any>;
  }) => Promise<Record<string, any>> | Record<string, any>;
  onSaveSuccess?: (params: {
    mode: "create" | "edit";
    payload: Record<string, any>;
    result: any;
    itemId?: string;
  }) => Promise<void> | void;
}

const getEditableFields = (
  fields: Record<string, AdminFieldConfig>,
  fieldOrder?: string[]
): [string, AdminFieldConfig][] => {
  const entries = Object.entries(fields).filter(([key]) => !SYSTEM_FIELDS.has(key));
  if (!fieldOrder || fieldOrder.length === 0) {
    return entries;
  }
  const entryMap = new Map(entries);
  const ordered: [string, AdminFieldConfig][] = [];
  for (const key of fieldOrder) {
    const config = entryMap.get(key);
    if (config) {
      ordered.push([key, config]);
      entryMap.delete(key);
    }
  }
  // Append any remaining fields not in fieldOrder
  for (const [key, config] of entryMap) {
    ordered.push([key, config]);
  }
  return ordered;
};

const getFieldDefault = (fieldConfig: AdminFieldConfig): any => {
  if (fieldConfig.default !== undefined) {
    return fieldConfig.default;
  }
  if (fieldConfig.type === "boolean") {
    return false;
  }
  if (fieldConfig.type === "number") {
    return 0;
  }
  return "";
};

const sanitizePayloadValue = (value: any): any => {
  if (value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayloadValue(item)).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    const nextValue: Record<string, any> = {};
    for (const [key, childValue] of Object.entries(value)) {
      const sanitizedChild = sanitizePayloadValue(childValue);
      if (sanitizedChild !== undefined) {
        nextValue[key] = sanitizedChild;
      }
    }
    return nextValue;
  }
  return value;
};

const DeleteButton: React.FC<{loading: boolean; onDelete: () => void}> = ({loading, onDelete}) => (
  <Button
    confirmationText="Are you sure you want to delete this item?"
    loading={loading}
    onClick={onDelete}
    testID="admin-delete-button"
    text="Delete"
    variant="destructive"
    withConfirmation
  />
);

const EmptyFields: React.FC = () => <Text color="secondaryDark">No editable fields.</Text>;

/**
 * Form screen for creating or editing a model instance in the admin panel.
 *
 * Auto-generates form fields based on the model schema from the backend configuration.
 * Handles field validation, type-specific inputs (text, boolean, select, date, reference fields),
 * and save/cancel actions. System fields (_id, __v, created, updated, deleted) are automatically
 * excluded from the form.
 *
 * @param props - Component props
 * @param props.baseUrl - Base URL for admin routes (e.g., "/admin")
 * @param props.api - RTK Query API instance for making authenticated requests
 * @param props.modelName - Name of the model to create/edit (e.g., "User")
 * @param props.mode - Form mode: "create" for new items, "edit" for existing items
 * @param props.itemId - ID of the item to edit (required when mode is "edit")
 *
 * @example
 * ```typescript
 * import {AdminModelForm} from "@terreno/admin-frontend";
 * import {api} from "@/store/openApiSdk";
 * import {useLocalSearchParams} from "expo-router";
 *
 * function AdminCreateScreen() {
 *   const {modelName} = useLocalSearchParams();
 *   return (
 *     <AdminModelForm
 *       baseUrl="/admin"
 *       api={api}
 *       modelName={modelName as string}
 *       mode="create"
 *     />
 *   );
 * }
 *
 * function AdminEditScreen() {
 *   const {modelName, id} = useLocalSearchParams();
 *   return (
 *     <AdminModelForm
 *       baseUrl="/admin"
 *       api={api}
 *       modelName={modelName as string}
 *       mode="edit"
 *       itemId={id as string}
 *     />
 *   );
 * }
 * ```
 *
 * @see AdminFieldRenderer for field type rendering
 * @see AdminModelTable for the list view
 * @see SYSTEM_FIELDS for excluded fields
 */
export const AdminModelForm: React.FC<AdminModelFormProps> = ({
  baseUrl,
  api,
  modelName,
  mode,
  itemId,
  footerContent,
  transformPayload,
  onSaveSuccess,
}) => {
  const {config, isLoading: isConfigLoading} = useAdminConfig(api, baseUrl);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const navigation = useNavigation();

  const modelConfig: AdminModelConfig | undefined = useMemo(
    () => config?.models.find((m: AdminModelConfig) => m.name === modelName),
    [config, modelName]
  );

  const toast = useToast();

  const {useReadQuery, useCreateMutation, useUpdateMutation, useDeleteMutation} = useAdminApi(
    api,
    modelConfig?.routePath ?? "",
    modelName
  );

  const {data: itemData, isLoading: isItemLoading} = useReadQuery(itemId ?? "", {
    skip: mode !== "edit" || !itemId || !modelConfig,
  });

  const [createItem, {isLoading: isCreating}] = useCreateMutation();
  const [updateItem, {isLoading: isUpdating}] = useUpdateMutation();
  const [deleteItem, {isLoading: isDeleting}] = useDeleteMutation();

  // Initialize form state from fetched item data in edit mode
  useEffect(() => {
    if (mode === "edit" && itemData && !isInitialized) {
      const initial: Record<string, any> = {};
      if (modelConfig) {
        for (const [key, fieldConfig] of getEditableFields(
          modelConfig.fields,
          modelConfig.fieldOrder
        )) {
          const raw = itemData[key];
          initial[key] = raw ?? getFieldDefault(fieldConfig);
        }
      }
      setFormState(initial);
      setIsInitialized(true);
    }
  }, [mode, itemData, modelConfig, isInitialized]);

  // Initialize form state with defaults in create mode
  useEffect(() => {
    if (mode === "create" && modelConfig && !isInitialized) {
      const initial: Record<string, any> = {};
      for (const [key, fieldConfig] of getEditableFields(
        modelConfig.fields,
        modelConfig.fieldOrder
      )) {
        initial[key] = getFieldDefault(fieldConfig);
      }
      setFormState(initial);
      setIsInitialized(true);
    }
  }, [mode, modelConfig, isInitialized]);

  const handleFieldChange = useCallback((fieldKey: string, value: any) => {
    setFormState((prev) => ({...prev, [fieldKey]: value}));
    setErrors((prev) => {
      const next = {...prev};
      delete next[fieldKey];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    if (!modelConfig) {
      return false;
    }
    const newErrors: Record<string, string> = {};
    for (const [key, fieldConfig] of getEditableFields(
      modelConfig.fields,
      modelConfig.fieldOrder
    )) {
      if (fieldConfig.required && (formState[key] == null || formState[key] === "")) {
        newErrors[key] = `${key} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [modelConfig, formState]);

  const handleSave = useCallback(async () => {
    if (!validate()) {
      return;
    }
    try {
      const sanitizedPayload = sanitizePayloadValue(formState) as Record<string, any>;
      const payload = transformPayload
        ? await transformPayload({mode, payload: sanitizedPayload})
        : sanitizedPayload;
      let result: any;
      if (mode === "create") {
        result = await createItem(payload).unwrap();
      } else if (itemId) {
        result = await updateItem({body: payload, id: itemId}).unwrap();
      }
      if (onSaveSuccess) {
        await onSaveSuccess({itemId, mode, payload, result});
      }
      router.back();
    } catch (err) {
      toast.catch(err, `Failed to ${mode === "create" ? "create" : "update"} ${modelName}`);
    }
  }, [
    mode,
    formState,
    itemId,
    createItem,
    updateItem,
    validate,
    toast,
    modelName,
    transformPayload,
    onSaveSuccess,
  ]);

  const handleDelete = useCallback(async () => {
    if (!itemId) {
      return;
    }
    try {
      await deleteItem(itemId).unwrap();
      router.back();
    } catch (err) {
      toast.catch(err, `Failed to delete ${modelName}`);
    }
  }, [itemId, deleteItem, toast, modelName]);

  const isSaving = isCreating || isUpdating;

  // Set header action buttons (save/delete)
  useEffect(() => {
    if (!modelConfig) {
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Box alignItems="center" direction="row" gap={2} justifyContent="center" marginRight={3}>
          {mode === "edit" && <DeleteButton loading={isDeleting} onDelete={handleDelete} />}
          <Button
            loading={isSaving}
            onClick={handleSave}
            testID="admin-save-button"
            text={mode === "create" ? "Create" : "Save"}
            variant="primary"
          />
        </Box>
      ),
    });
  }, [navigation, modelConfig, mode, isSaving, isDeleting, handleSave, handleDelete]);

  if (isConfigLoading || !modelConfig) {
    return (
      <Page maxWidth="100%">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (mode === "edit" && isItemLoading) {
    return (
      <Page maxWidth="100%">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  const editableFields = getEditableFields(modelConfig.fields, modelConfig.fieldOrder);

  const modelConfigs =
    config?.models.map((m: AdminModelConfig) => ({name: m.name, routePath: m.routePath})) ?? [];

  return (
    <Page maxWidth="100%" scroll>
      <Box gap={3} padding={4}>
        {editableFields.map(([fieldKey, fieldConfig]) => (
          <AdminFieldRenderer
            api={api}
            baseUrl={baseUrl}
            errorText={errors[fieldKey]}
            fieldConfig={fieldConfig}
            fieldKey={fieldKey}
            key={fieldKey}
            modelConfigs={modelConfigs}
            onChange={(value: any) => handleFieldChange(fieldKey, value)}
            parentFormState={formState}
            value={formState[fieldKey]}
          />
        ))}
        {editableFields.length === 0 && <EmptyFields />}
        {footerContent}
      </Box>
    </Page>
  );
};
