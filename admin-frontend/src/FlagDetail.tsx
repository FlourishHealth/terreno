import type {Api} from "@reduxjs/toolkit/query/react";
import {
  Badge,
  BooleanField,
  Box,
  Button,
  Card,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  type DataTableCustomComponentMap,
  Page,
  Spinner,
  Text,
  TextField,
} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";
import {useFlagsApi} from "./useFlagsApi";

interface FlagDetailProps {
  baseUrl: string;
  api: Api<any, any, any, any>;
  flagKey: string;
}

const REMOVE_OVERRIDE_COLUMN_TYPE = "removeOverride";

export const FlagDetail: React.FC<FlagDetailProps> = ({baseUrl, api, flagKey}) => {
  const {
    useGetFlagQuery,
    useUpdateFlagMutation,
    useListFlagUsersQuery,
    useSetUserOverrideMutation,
    useRemoveUserOverrideMutation,
  } = useFlagsApi(api, baseUrl);

  const {data: flag, isLoading, error} = useGetFlagQuery(flagKey);
  const {data: usersData} = useListFlagUsersQuery(flagKey);
  const [updateFlag] = useUpdateFlagMutation();
  const [setUserOverride] = useSetUserOverrideMutation();
  const [removeUserOverride] = useRemoveUserOverrideMutation();

  const [newOverrideUserId, setNewOverrideUserId] = useState("");
  const [newOverrideValue, setNewOverrideValue] = useState("");

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (!flag) {
        return;
      }
      await updateFlag({enabled: value, key: flagKey}).unwrap();
    },
    [flag, flagKey, updateFlag]
  );

  const handleGlobalValueChange = useCallback(
    async (value: string) => {
      if (!flag) {
        return;
      }
      const parsedValue = flag.flagType === "boolean" ? value === "true" : value;
      await updateFlag({globalValue: parsedValue, key: flagKey}).unwrap();
    },
    [flag, flagKey, updateFlag]
  );

  const handleAddOverride = useCallback(async () => {
    if (!newOverrideUserId || !flag) {
      return;
    }
    const value = flag.flagType === "boolean" ? newOverrideValue === "true" : newOverrideValue;
    await setUserOverride({key: flagKey, userId: newOverrideUserId, value}).unwrap();
    setNewOverrideUserId("");
    setNewOverrideValue("");
  }, [flag, flagKey, newOverrideUserId, newOverrideValue, setUserOverride]);

  const handleRemoveOverride = useCallback(
    async (userId: string) => {
      await removeUserOverride({key: flagKey, userId}).unwrap();
    },
    [flagKey, removeUserOverride]
  );

  const RemoveOverrideCell: React.FC<{
    column: DataTableColumn;
    cellData: DataTableCellData;
  }> = useCallback(
    ({cellData}: {column: DataTableColumn; cellData: DataTableCellData}) => {
      const userId = cellData.value as string;
      return (
        <Button onClick={() => handleRemoveOverride(userId)} text="Remove" variant="destructive" />
      );
    },
    [handleRemoveOverride]
  );

  const customColumnComponentMap: DataTableCustomComponentMap = useMemo(
    () => ({
      [REMOVE_OVERRIDE_COLUMN_TYPE]: RemoveOverrideCell,
    }),
    [RemoveOverrideCell]
  );

  const overrideColumns: DataTableColumn[] = [
    {columnType: "text", sortable: false, title: "Email", width: 250},
    {columnType: "text", sortable: false, title: "Name", width: 200},
    {columnType: "text", sortable: false, title: "Override Value", width: 150},
    {columnType: REMOVE_OVERRIDE_COLUMN_TYPE, sortable: false, title: "", width: 100},
  ];

  const overrideData = useMemo(() => {
    if (!usersData?.data) {
      return [];
    }
    return usersData.data.map((user: any) => [
      {value: user.email ?? ""},
      {value: user.name ?? ""},
      {value: String(user.overrideValue ?? "")},
      {value: user._id},
    ]);
  }, [usersData]);

  if (isLoading) {
    return (
      <Page backButton title="Flag Detail">
        <Box alignItems="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (error || !flag) {
    return (
      <Page backButton title="Flag Detail">
        <Text color="error">Failed to load flag</Text>
      </Page>
    );
  }

  return (
    <Page backButton title={`Flag: ${flag.key}`}>
      <Box gap={6} padding={4}>
        {/* Metadata */}
        <Card padding={4}>
          <Box gap={3}>
            <Text bold size="lg">
              Metadata
            </Text>
            <Box direction="row" gap={6}>
              <Box gap={1}>
                <Text color="secondaryDark">Key</Text>
                <Text>{flag.key}</Text>
              </Box>
              <Box gap={1}>
                <Text color="secondaryDark">Type</Text>
                <Text>{flag.flagType}</Text>
              </Box>
              <Box gap={1}>
                <Text color="secondaryDark">Default Value</Text>
                <Text>{String(flag.defaultValue)}</Text>
              </Box>
              <Box gap={1}>
                <Text color="secondaryDark">Status</Text>
                <Badge
                  status={flag.status === "active" ? "success" : "neutral"}
                  value={flag.status}
                />
              </Box>
            </Box>
            {flag.description ? <Text>{flag.description}</Text> : null}
          </Box>
        </Card>

        {/* Global Controls */}
        <Card padding={4}>
          <Box gap={3}>
            <Text bold size="lg">
              Global Controls
            </Text>
            <BooleanField onChange={handleToggle} title="Enabled" value={flag.enabled} />
            {flag.flagType === "boolean" ? (
              <BooleanField
                onChange={(val) => handleGlobalValueChange(val ? "true" : "false")}
                title="Global Value"
                value={flag.globalValue === true}
              />
            ) : (
              <TextField
                onChange={handleGlobalValueChange}
                title="Global Value"
                value={flag.globalValue != null ? String(flag.globalValue) : ""}
              />
            )}
          </Box>
        </Card>

        {/* User Overrides */}
        <Card padding={4}>
          <Box gap={3}>
            <Text bold size="lg">
              User Overrides
            </Text>
            <Box alignItems="end" direction="row" gap={2}>
              <TextField
                onChange={setNewOverrideUserId}
                placeholder="Enter user ID"
                title="User ID"
                value={newOverrideUserId}
              />
              <TextField
                onChange={setNewOverrideValue}
                placeholder={flag.flagType === "boolean" ? "true or false" : "Enter value"}
                title="Value"
                value={newOverrideValue}
              />
              <Button onClick={handleAddOverride} text="Add Override" />
            </Box>
            {overrideData.length > 0 ? (
              <DataTable
                columns={overrideColumns}
                customColumnComponentMap={customColumnComponentMap}
                data={overrideData}
              />
            ) : (
              <Text color="secondaryDark">No user overrides.</Text>
            )}
          </Box>
        </Card>
      </Box>
    </Page>
  );
};
