import {Box, Heading, Spinner, Text} from "@terreno/ui";
import React, {useCallback, useEffect, useState} from "react";

import type {AdminScreenProps} from "./types";
import {resolveAdminBases} from "./types";

interface RbacRoleRow {
  name: string;
  displayName: string;
  description?: string;
  isLocked?: boolean;
}

export const AdminRolesList: React.FC<AdminScreenProps> = ({apiBase, baseUrl}) => {
  const {apiBase: resolvedApiBase} = resolveAdminBases({apiBase, baseUrl});
  const [roles, setRoles] = useState<RbacRoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const rbacBase = resolvedApiBase.replace(/\/admin\/?$/, "") || "";
      const response = await fetch(`${rbacBase}/rbac/roles`, {credentials: "include"});
      if (!response.ok) {
        throw new Error(`Failed to load roles (${response.status})`);
      }
      const json = (await response.json()) as {data: RbacRoleRow[]};
      setRoles(json.data ?? []);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  }, [resolvedApiBase]);

  // Load roles when the screen mounts.
  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  if (isLoading) {
    return (
      <Box alignItems="center" padding={4}>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={4}>
        <Text color="error">{error}</Text>
      </Box>
    );
  }

  return (
    <Box gap={3} padding={4}>
      <Heading size="lg">Roles</Heading>
      {roles.length === 0 ? (
        <Text>No roles found.</Text>
      ) : (
        roles.map((role) => (
          <Box gap={1} key={role.name}>
            <Text size="md">{role.displayName}</Text>
            <Text color="link" size="sm">
              {role.name}
              {role.isLocked ? " (locked)" : ""}
            </Text>
            {role.description ? <Text size="sm">{role.description}</Text> : null}
          </Box>
        ))
      )}
    </Box>
  );
};
