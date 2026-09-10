import {Box, Button, Card, Spinner, Text, TextField} from "@terreno/ui";
import React, {useCallback, useEffect, useState} from "react";
import {AdminScreenPage} from "../AdminScreenPage";
import type {AdminApi} from "../types";
import type {OrganizationSummary} from "./OrgDirectoryScreen";
import {useOrganizationsApi} from "./useOrganizationsApi";

export interface OrgSettingsScreenProps {
  api: AdminApi;
  basePath?: string;
  organizationId: string;
  routeBase?: string;
}

interface OrganizationDetail extends OrganizationSummary {
  settings?: Record<string, unknown>;
}

const errorTitle = (error: unknown, fallback: string): string => {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }
  const data = (error as {data?: unknown}).data;
  if (typeof data !== "object" || data === null) {
    return fallback;
  }
  const title = (data as {title?: unknown}).title;
  return typeof title === "string" ? title : fallback;
};

export const OrgSettingsScreen: React.FC<OrgSettingsScreenProps> = ({
  api,
  basePath,
  organizationId,
  routeBase = "/admin",
}) => {
  const {useReadQuery, useUpdateMutation} = useOrganizationsApi(api, basePath, organizationId);
  const {data, error, isLoading} = useReadQuery(organizationId);
  const organization = (data?.data ?? data) as OrganizationDetail | undefined;
  const [name, setName] = useState("");
  const [settingsText, setSettingsText] = useState("{}");
  const [saveError, setSaveError] = useState<string>();
  const [updateOrganization, {isLoading: isSaving}] = useUpdateMutation();

  // Reconcile editable fields when the selected organization response changes.
  useEffect(() => {
    if (!organization) {
      return;
    }
    setName(organization.name);
    setSettingsText(JSON.stringify(organization.settings ?? {}, null, 2));
  }, [organization]);

  const handleSave = useCallback(async (): Promise<void> => {
    let settings: Record<string, unknown>;
    try {
      const parsed = JSON.parse(settingsText) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setSaveError("Settings must be a JSON object.");
        return;
      }
      settings = parsed as Record<string, unknown>;
    } catch {
      setSaveError("Settings must be valid JSON.");
      return;
    }
    try {
      setSaveError(undefined);
      await updateOrganization({
        body: {name: name.trim(), settings},
        id: organizationId,
      }).unwrap();
    } catch (mutationError) {
      setSaveError(errorTitle(mutationError, "Could not save organization settings."));
    }
  }, [name, organizationId, settingsText, updateOrganization]);

  if (isLoading) {
    return (
      <Box alignItems="center" padding={6}>
        <Spinner />
      </Box>
    );
  }
  if (error || !organization) {
    return <Text color="error">{errorTitle(error, "Could not load organization settings.")}</Text>;
  }

  return (
    <AdminScreenPage
      backHref={`${routeBase}/orgs`}
      color="transparent"
      padding={0}
      title={`${organization.name} settings`}
    >
      <Box gap={4} padding={4}>
        <Card gap={3} padding={4}>
          <TextField onChange={setName} testID="org-settings-name" title="Name" value={name} />
          <TextField
            multiline
            onChange={setSettingsText}
            testID="org-settings-json"
            title="Settings (JSON)"
            value={settingsText}
          />
          {saveError ? (
            <Text color="error" testID="org-settings-error">
              {saveError}
            </Text>
          ) : null}
          <Button
            loading={isSaving}
            onClick={() => {
              void handleSave();
            }}
            testID="org-settings-save"
            text="Save settings"
          />
        </Card>
        <Card gap={2} padding={4}>
          <Text bold>Billing</Text>
          <Text color="secondaryDark">Billing is not available yet.</Text>
        </Card>
      </Box>
    </AdminScreenPage>
  );
};
