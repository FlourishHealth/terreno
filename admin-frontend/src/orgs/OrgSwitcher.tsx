import {Box, Button, SelectField, Spinner, Text} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback, useEffect} from "react";
import type {AdminApi} from "../types";
import {normalizeListData} from "./normalizeListData";
import type {OrganizationSummary} from "./OrgDirectoryScreen";
import {useOrganizationsApi} from "./useOrganizationsApi";
import {useOrgContext} from "./useOrgContext";

export interface OrgSwitcherProps {
  api: AdminApi;
  basePath?: string;
  routeBase?: string;
}

export const OrgSwitcher: React.FC<OrgSwitcherProps> = ({api, basePath, routeBase = "/admin"}) => {
  const {organization, selectOrganization} = useOrgContext();
  const {useMineQuery} = useOrganizationsApi(api, basePath);
  const {data, error, isLoading} = useMineQuery();
  const organizations = normalizeListData<OrganizationSummary>(data);

  const handleChange = useCallback(
    (organizationId: string): void => {
      const nextOrganization = organizations.find((candidate) => candidate._id === organizationId);
      if (!nextOrganization) {
        return;
      }
      selectOrganization(nextOrganization);
      const prefix = routeBase.endsWith("/") ? routeBase.slice(0, -1) : routeBase;
      router.push(`${prefix}/orgs/${nextOrganization._id}` as Href);
    },
    [organizations, routeBase, selectOrganization]
  );

  // Select the sole available organization so single-org admins still get scoped requests.
  useEffect(() => {
    if (!organization && organizations.length === 1) {
      selectOrganization(organizations[0]);
    }
  }, [organization, organizations, selectOrganization]);

  if (isLoading) {
    return <Spinner size="sm" />;
  }
  if (error) {
    return (
      <Text color="error" size="sm">
        Organizations unavailable
      </Text>
    );
  }
  if (organizations.length === 0) {
    return null;
  }
  if (organizations.length === 1) {
    return (
      <Box gap={1} testID="org-switcher-single">
        <Text color="secondaryDark" size="sm">
          Organization
        </Text>
        <Button
          onClick={() => handleChange(organizations[0]._id)}
          testID="org-switcher-single-open"
          text={organizations[0].name}
          variant="outline"
        />
      </Box>
    );
  }
  return (
    <SelectField
      onChange={handleChange}
      options={organizations.map((candidate) => ({
        label: candidate.name,
        value: candidate._id,
      }))}
      placeholder="Select organization"
      testID="org-switcher"
      title="Organization"
      value={organization?._id ?? ""}
    />
  );
};
