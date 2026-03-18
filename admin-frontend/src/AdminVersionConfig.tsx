import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Button, NumberField, Page, Spinner, Text, TextField, useToast} from "@terreno/ui";
import {router} from "expo-router";
import React, {useCallback, useEffect, useMemo, useState} from "react";

interface VersionConfigData {
  mobileRequiredVersion?: number;
  mobileWarningVersion?: number;
  requiredMessage?: string;
  updateUrl?: string | null;
  webRequiredVersion?: number;
  webWarningVersion?: number;
  warningMessage?: string;
}

interface AdminVersionConfigProps {
  api: Api<any, any, any, any>;
  baseUrl: string;
}

const VERSION_CONFIG_ENDPOINT = "adminVersionConfig";

export const AdminVersionConfig: React.FC<AdminVersionConfigProps> = ({api, baseUrl}) => {
  const [formState, setFormState] = useState<VersionConfigData>({});
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        [VERSION_CONFIG_ENDPOINT]: build.query({
          query: () => ({
            method: "GET",
            url: `${baseUrl}/version-config`,
          }),
        }),
        updateVersionConfig: build.mutation({
          query: (body: VersionConfigData) => ({
            body,
            method: "PUT",
            url: `${baseUrl}/version-config`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, baseUrl]);

  const useVersionConfigQuery = (enhancedApi as any).useAdminVersionConfigQuery;
  const [updateConfig] = (enhancedApi as any).useUpdateVersionConfigMutation();

  const {data, isLoading: isFetching, error: fetchError} = useVersionConfigQuery();

  // Populate form state with fetched config data or defaults when the query completes
  useEffect(() => {
    if (isFetching || fetchError) {
      return;
    }
    const defaults = {
      mobileRequiredVersion: 0,
      mobileWarningVersion: 0,
      requiredMessage: "This version is no longer supported. Please update to continue.",
      updateUrl: "",
      warningMessage: "A new version is available. Please update for the best experience.",
      webRequiredVersion: 0,
      webWarningVersion: 0,
    };
    if (data) {
      setFormState({
        mobileRequiredVersion: data.mobileRequiredVersion ?? 0,
        mobileWarningVersion: data.mobileWarningVersion ?? 0,
        requiredMessage: data.requiredMessage ?? defaults.requiredMessage,
        updateUrl: data.updateUrl ?? "",
        warningMessage: data.warningMessage ?? defaults.warningMessage,
        webRequiredVersion: data.webRequiredVersion ?? 0,
        webWarningVersion: data.webWarningVersion ?? 0,
      });
    } else {
      setFormState(defaults);
    }
  }, [data, isFetching, fetchError]);

  const handleFieldChange = useCallback(
    (field: keyof VersionConfigData, value: string | number) => {
      setFormState((prev) => ({...prev, [field]: value}));
    },
    []
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const trimmedUpdateUrl = (formState.updateUrl ?? "").trim();
      await updateConfig({
        mobileRequiredVersion: Number(formState.mobileRequiredVersion) || 0,
        mobileWarningVersion: Number(formState.mobileWarningVersion) || 0,
        requiredMessage: formState.requiredMessage ?? "",
        updateUrl: trimmedUpdateUrl || null,
        warningMessage: formState.warningMessage ?? "",
        webRequiredVersion: Number(formState.webRequiredVersion) || 0,
        webWarningVersion: Number(formState.webWarningVersion) || 0,
      }).unwrap();
      toast.success("Version config saved");
    } catch (error) {
      toast.error("Failed to save version config");
      console.error("Failed to save version config:", error);
    } finally {
      setIsSaving(false);
    }
  }, [formState, updateConfig, toast]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  if (isFetching) {
    return (
      <Page maxWidth="100%" title="Version Config">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (fetchError) {
    return (
      <Page maxWidth="100%" title="Version Config">
        <Box alignItems="center" gap={4} justifyContent="center" padding={6}>
          <Text color="error">Failed to load version config. Please try again later.</Text>
          <Button onClick={handleBack} text="Back" variant="outline" />
        </Box>
      </Page>
    );
  }

  return (
    <Page maxWidth="100%" scroll title="Version Config">
      <Box gap={4} padding={4}>
        <Text color="secondaryDark" size="sm">
          Configure version thresholds for upgrade warnings and blocks. Use build numbers (e.g. from
          git rev-list --count HEAD). Set to 0 to disable.
        </Text>

        <Box gap={2}>
          <Text bold size="md">
            Web
          </Text>
          <NumberField
            onChange={(v) => handleFieldChange("webWarningVersion", parseInt(v, 10) || 0)}
            title="Warning version (build number)"
            type="number"
            value={String(formState.webWarningVersion ?? 0)}
          />
          <NumberField
            onChange={(v) => handleFieldChange("webRequiredVersion", parseInt(v, 10) || 0)}
            title="Required version (build number)"
            type="number"
            value={String(formState.webRequiredVersion ?? 0)}
          />
        </Box>

        <Box gap={2}>
          <Text bold size="md">
            Mobile
          </Text>
          <NumberField
            onChange={(v) => handleFieldChange("mobileWarningVersion", parseInt(v, 10) || 0)}
            title="Warning version (build number)"
            type="number"
            value={String(formState.mobileWarningVersion ?? 0)}
          />
          <NumberField
            onChange={(v) => handleFieldChange("mobileRequiredVersion", parseInt(v, 10) || 0)}
            title="Required version (build number)"
            type="number"
            value={String(formState.mobileRequiredVersion ?? 0)}
          />
        </Box>

        <Box gap={2}>
          <Text bold size="md">
            Messages
          </Text>
          <TextField
            onChange={(v) => handleFieldChange("warningMessage", v)}
            title="Warning message"
            value={formState.warningMessage ?? ""}
          />
          <TextField
            onChange={(v) => handleFieldChange("requiredMessage", v)}
            title="Required (blocking) message"
            value={formState.requiredMessage ?? ""}
          />
        </Box>

        <Box gap={2}>
          <TextField
            onChange={(v) => handleFieldChange("updateUrl", v)}
            title="Update URL (optional, for mobile app store link)"
            value={formState.updateUrl ?? ""}
          />
        </Box>

        <Box direction="row" gap={2}>
          <Button onClick={handleBack} text="Back" variant="outline" />
          <Button loading={isSaving} onClick={handleSave} text="Save" variant="primary" />
        </Box>
      </Box>
    </Page>
  );
};
