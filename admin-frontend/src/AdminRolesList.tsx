import {Badge, Box, Heading, Spinner, Text} from "@terreno/ui";
import React from "react";

import type {AdminScreenProps} from "./types";
import {resolveAdminBases} from "./types";
import {normalizeRoles, useAdminRoles} from "./useAdminRoles";

export const AdminRolesList: React.FC<AdminScreenProps> = ({api, apiBase, baseUrl}) => {
  const {apiBase: resolvedApiBase} = resolveAdminBases({apiBase, baseUrl});
  const {useListRolesQuery} = useAdminRoles(api, resolvedApiBase);
  const {data, error, isLoading} = useListRolesQuery();
  const roles = normalizeRoles(data);

  if (isLoading) {
    return (
      <Box alignItems="center" padding={4} testID="admin-roles-loading">
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={4} testID="admin-roles-error">
        <Text color="error">Failed to load roles.</Text>
      </Box>
    );
  }

  return (
    <Box gap={3} padding={4} testID="admin-roles-list">
      <Heading size="lg">Roles</Heading>
      {roles.length === 0 ? (
        <Text>No roles found.</Text>
      ) : (
        roles.map((role) => (
          <Box direction="column" gap={1} key={role.name} testID={`admin-roles-item-${role.name}`}>
            <Box alignItems="center" direction="row" gap={2}>
              <Text bold size="md">
                {role.displayName}
              </Text>
              {role.isLocked ? <Badge secondary status="info" value="locked" /> : null}
            </Box>
            <Text color="secondaryLight" size="sm">
              {role.name}
            </Text>
            {role.description ? <Text size="sm">{role.description}</Text> : null}
          </Box>
        ))
      )}
    </Box>
  );
};
