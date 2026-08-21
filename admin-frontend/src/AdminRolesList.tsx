import {
  Badge,
  Box,
  Button,
  CheckBox,
  Heading,
  Modal,
  Spinner,
  Text,
  TextField,
} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";

import type {AdminScreenProps} from "./types";
import {resolveAdminBases} from "./types";
import {
  normalizeRoles,
  normalizeStatements,
  type RbacRoleRow,
  useAdminRoles,
} from "./useAdminRoles";

interface RoleFormState {
  description: string;
  displayName: string;
  name: string;
  permissions: Record<string, string[]>;
}

const EMPTY_ROLE_FORM: RoleFormState = {
  description: "",
  displayName: "",
  name: "",
  permissions: {},
};

const clonePermissions = (
  permissions?: Record<string, string[]>
): Record<string, string[]> => {
  return Object.fromEntries(
    Object.entries(permissions ?? {}).map(([resource, actions]) => [resource, [...actions]])
  );
};

export const AdminRolesList: React.FC<AdminScreenProps> = ({api, apiBase, baseUrl}) => {
  const {apiBase: resolvedApiBase} = resolveAdminBases({apiBase, baseUrl});
  const {
    useCreateRoleMutation,
    useListRolesQuery,
    useListStatementsQuery,
    useUpdateRoleMutation,
  } = useAdminRoles(api, resolvedApiBase);
  const {data, error, isLoading, refetch} = useListRolesQuery();
  const {
    data: statementsData,
    error: statementsError,
    isLoading: areStatementsLoading,
  } = useListStatementsQuery();
  const [createRole, {isLoading: isCreating}] = useCreateRoleMutation();
  const [updateRole, {isLoading: isUpdating}] = useUpdateRoleMutation();
  const roles = normalizeRoles(data);
  const statements = normalizeStatements(statementsData);
  const resources = useMemo(() => Object.keys(statements).sort(), [statements]);
  const [editingRole, setEditingRole] = useState<RbacRoleRow | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSaving = isCreating || isUpdating;

  const handleCreate = useCallback((): void => {
    setEditingRole(null);
    setForm(EMPTY_ROLE_FORM);
    setSaveError(null);
    setIsFormVisible(true);
  }, []);

  const handleEdit = useCallback((role: RbacRoleRow): void => {
    setEditingRole(role);
    setForm({
      description: role.description ?? "",
      displayName: role.displayName,
      name: role.name,
      permissions: clonePermissions(role.permissions),
    });
    setSaveError(null);
    setIsFormVisible(true);
  }, []);

  const handleDismiss = useCallback((): void => {
    setIsFormVisible(false);
    setSaveError(null);
  }, []);

  const handleFieldChange = useCallback(
    (field: "description" | "displayName" | "name", value: string): void => {
      setForm((current) => ({...current, [field]: value}));
    },
    []
  );

  const handlePermissionToggle = useCallback((resource: string, action: string): void => {
    setForm((current) => {
      const currentActions = current.permissions[resource] ?? [];
      const isSelected = currentActions.includes(action);
      const nextActions = isSelected
        ? currentActions.filter((item) => item !== action)
        : [...currentActions, action].sort();
      const permissions = {...current.permissions};
      if (nextActions.length === 0) {
        Reflect.deleteProperty(permissions, resource);
      } else {
        permissions[resource] = nextActions;
      }
      return {...current, permissions};
    });
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    const name = form.name.trim();
    const displayName = form.displayName.trim();
    if (!name || !displayName) {
      setSaveError("Name and display name are required.");
      return;
    }
    setSaveError(null);
    try {
      if (editingRole) {
        await updateRole({
          changes: {
            description: form.description.trim() || undefined,
            displayName,
            permissions: form.permissions,
          },
          roleName: editingRole.name,
        }).unwrap();
      } else {
        await createRole({
          description: form.description.trim() || undefined,
          displayName,
          name,
          permissions: form.permissions,
        }).unwrap();
      }
      setIsFormVisible(false);
      refetch?.();
    } catch (saveFailure: unknown) {
      const data = (saveFailure as {data?: {detail?: string; title?: string}})?.data;
      setSaveError(data?.detail ?? data?.title ?? "Failed to save role.");
    }
  }, [createRole, editingRole, form, refetch, updateRole]);

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
      <Box alignItems="center" direction="row" justifyContent="between">
        <Heading size="lg">Roles</Heading>
        <Button
          iconName="plus"
          onClick={handleCreate}
          testID="admin-roles-add-button"
          text="Add role"
        />
      </Box>
      {roles.length === 0 ? (
        <Text>No roles found.</Text>
      ) : (
        roles.map((role) => (
          <Box
            border="default"
            direction="column"
            gap={2}
            key={role.name}
            padding={3}
            rounding="md"
            testID={`admin-roles-item-${role.name}`}
          >
            <Box alignItems="center" direction="row" gap={2} justifyContent="between">
              <Box alignItems="center" direction="row" gap={2}>
                <Text bold size="md">
                  {role.displayName}
                </Text>
                {role.isLocked ? <Badge secondary status="info" value="locked" /> : null}
                {role.isSealed ? <Badge secondary status="warning" value="sealed" /> : null}
              </Box>
              <Button
                disabled={role.isSealed}
                iconName="pen"
                onClick={() => handleEdit(role)}
                testID={`admin-roles-edit-${role.name}`}
                text="Edit"
                variant="outline"
              />
            </Box>
            <Text color="secondaryLight" size="sm">
              {role.name}
            </Text>
            {role.description ? <Text size="sm">{role.description}</Text> : null}
            <Box direction="row" gap={1} wrap>
              {Object.entries(role.permissions ?? {}).flatMap(([resource, actions]) =>
                actions.map((action) => (
                  <Badge key={`${resource}:${action}`} value={`${resource}:${action}`} />
                ))
              )}
            </Box>
          </Box>
        ))
      )}

      <Box border="default" gap={2} padding={3} rounding="md" testID="admin-permissions-list">
        <Heading size="md">Available permissions</Heading>
        {areStatementsLoading ? <Spinner /> : null}
        {statementsError ? <Text color="error">Failed to load permissions.</Text> : null}
        {!areStatementsLoading && !statementsError
          ? resources.map((resource) => (
              <Box gap={1} key={resource}>
                <Text bold>{resource}</Text>
                <Box direction="row" gap={1} wrap>
                  {statements[resource].map((action) => (
                    <Badge key={`${resource}:${action}`} value={`${resource}:${action}`} />
                  ))}
                </Box>
              </Box>
            ))
          : null}
      </Box>

      <Modal onDismiss={handleDismiss} size="lg" visible={isFormVisible}>
        <Box gap={4} padding={2} testID="admin-role-form">
          <Heading size="md">{editingRole ? `Edit ${editingRole.displayName}` : "Add role"}</Heading>
          <TextField
            disabled={Boolean(editingRole)}
            onChange={(value) => handleFieldChange("name", value)}
            testID="admin-role-name"
            title="Name"
            value={form.name}
          />
          <TextField
            onChange={(value) => handleFieldChange("displayName", value)}
            testID="admin-role-display-name"
            title="Display name"
            value={form.displayName}
          />
          <TextField
            onChange={(value) => handleFieldChange("description", value)}
            testID="admin-role-description"
            title="Description"
            value={form.description}
          />
          <Box gap={2}>
            <Heading size="sm">Permissions</Heading>
            {resources.map((resource) => (
              <Box gap={1} key={resource}>
                <Text bold>{resource}</Text>
                <Box direction="row" gap={3} wrap>
                  {statements[resource].map((action) => {
                    const isSelected = form.permissions[resource]?.includes(action) ?? false;
                    return (
                      <Box
                        alignItems="center"
                        direction="row"
                        gap={1}
                        key={`${resource}:${action}`}
                        onClick={() => handlePermissionToggle(resource, action)}
                        testID={`admin-role-permission-${resource}-${action}`}
                      >
                        <CheckBox selected={isSelected} />
                        <Text>{action}</Text>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
          {saveError ? (
            <Text color="error" testID="admin-role-save-error">
              {saveError}
            </Text>
          ) : null}
          <Box direction="row" gap={2} justifyContent="end">
            <Button onClick={handleDismiss} text="Cancel" variant="muted" />
            <Button
              loading={isSaving}
              onClick={handleSave}
              testID="admin-role-save-button"
              text={editingRole ? "Save role" : "Create role"}
            />
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};
