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
}

const getEditableFields = (
  fields: Record<string, AdminFieldConfig>
): [string, AdminFieldConfig][] => {
  return Object.entries(fields).filter(([key]) => !SYSTEM_FIELDS.has(key));
};

export const AdminModelForm: React.FC<AdminModelFormProps> = ({
  baseUrl,
  api,
  modelName,
  mode,
  itemId,
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

  // Set the navigation header title based on mode and model name
  useEffect(() => {
    if (!modelConfig) {
      return;
    }
    const title =
      mode === "create" ? `Create ${modelConfig.displayName}` : `Edit ${modelConfig.displayName}`;
    navigation.setOptions({title});
  }, [navigation, mode, modelConfig]);

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

  // Initialize form state from fetched item in edit mode
  useEffect(() => {
    if (mode === "edit" && itemData && !isInitialized) {
      const initial: Record<string, any> = {};
      if (modelConfig) {
        for (const [key] of getEditableFields(modelConfig.fields)) {
          initial[key] = itemData[key] ?? "";
        }
      }
      setFormState(initial);
      setIsInitialized(true);
    }
  }, [mode, itemData, modelConfig, isInitialized]);

  // Initialize default values in create mode
  useEffect(() => {
    if (mode === "create" && modelConfig && !isInitialized) {
      const initial: Record<string, any> = {};
      for (const [key, fieldConfig] of getEditableFields(modelConfig.fields)) {
        initial[key] = fieldConfig.default ?? "";
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
    for (const [key, fieldConfig] of getEditableFields(modelConfig.fields)) {
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
      if (mode === "create") {
        await createItem(formState).unwrap();
      } else if (itemId) {
        await updateItem({body: formState, id: itemId}).unwrap();
      }
      router.back();
    } catch (err) {
      toast.catch(err, `Failed to ${mode === "create" ? "create" : "update"} ${modelName}`);
    }
  }, [mode, formState, itemId, createItem, updateItem, validate, toast, modelName]);

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

  const editableFields = getEditableFields(modelConfig.fields);
  const isSaving = isCreating || isUpdating;

  const modelConfigs =
    config?.models.map((m: AdminModelConfig) => ({name: m.name, routePath: m.routePath})) ?? [];

  return (
    <Page
      footer={
        <Box direction="row" gap={2} justifyContent="between" padding={2}>
          <Box>
            {mode === "edit" && (
              <Button
                confirmationText="Are you sure you want to delete this item?"
                loading={isDeleting}
                onClick={handleDelete}
                testID="admin-delete-button"
                text="Delete"
                variant="destructive"
                withConfirmation
              />
            )}
          </Box>
          <Button
            loading={isSaving}
            onClick={handleSave}
            testID="admin-save-button"
            text={mode === "create" ? "Create" : "Save"}
            variant="primary"
          />
        </Box>
      }
      maxWidth="100%"
      scroll
    >
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
            value={formState[fieldKey]}
          />
        ))}
        {editableFields.length === 0 && <Text color="secondaryDark">No editable fields.</Text>}
      </Box>
    </Page>
  );
};
