import type {Api} from "@reduxjs/toolkit/query/react";
import {
  Badge,
  Box,
  Button,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  type DataTableCustomComponentMap,
  Page,
  SelectField,
  Spinner,
  Text,
} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";
import {useFlagsApi} from "./useFlagsApi";

interface FlagListProps {
  baseUrl: string;
  api: Api<any, any, any, any>;
  onFlagPress?: (key: string) => void;
}

const FLAG_TOGGLE_COLUMN_TYPE = "flagToggle";
const FLAG_STATUS_COLUMN_TYPE = "flagStatus";
const FLAG_LINK_COLUMN_TYPE = "flagLink";

const FlagToggleCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {enabled, onToggle} = cellData.value as {enabled: boolean; onToggle: () => void};
  return (
    <Button
      onClick={onToggle}
      text={enabled ? "On" : "Off"}
      variant={enabled ? "primary" : "muted"}
    />
  );
};

const FlagStatusCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const status = cellData.value as string;
  return <Badge status={status === "active" ? "success" : "neutral"} value={status} />;
};

export const FlagList: React.FC<FlagListProps> = ({baseUrl, api, onFlagPress}) => {
  const {useListFlagsQuery, useUpdateFlagMutation} = useFlagsApi(api, baseUrl);
  const [statusFilter, setStatusFilter] = useState("active");
  const {data, isLoading, error} = useListFlagsQuery(
    statusFilter ? {status: statusFilter} : undefined
  );
  const [updateFlag] = useUpdateFlagMutation();

  const handleToggle = useCallback(
    async (key: string, enabled: boolean) => {
      await updateFlag({enabled, key}).unwrap();
    },
    [updateFlag]
  );

  const FlagLinkCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> =
    useCallback(
      ({cellData}: {column: DataTableColumn; cellData: DataTableCellData}) => {
        const {key, text} = cellData.value as {key: string; text: string};
        if (onFlagPress) {
          return (
            <Text bold color="primary" onClick={() => onFlagPress(key)}>
              {text}
            </Text>
          );
        }
        return <Text>{text}</Text>;
      },
      [onFlagPress]
    );

  const customColumnComponentMap: DataTableCustomComponentMap = useMemo(
    () => ({
      [FLAG_LINK_COLUMN_TYPE]: FlagLinkCell,
      [FLAG_STATUS_COLUMN_TYPE]: FlagStatusCell,
      [FLAG_TOGGLE_COLUMN_TYPE]: FlagToggleCell,
    }),
    [FlagLinkCell]
  );

  const columns: DataTableColumn[] = [
    {columnType: FLAG_LINK_COLUMN_TYPE, sortable: true, title: "Key", width: 200},
    {columnType: "text", sortable: false, title: "Description", width: 300},
    {columnType: "text", sortable: false, title: "Type", width: 100},
    {columnType: FLAG_TOGGLE_COLUMN_TYPE, sortable: false, title: "Enabled", width: 100},
    {columnType: FLAG_STATUS_COLUMN_TYPE, sortable: false, title: "Status", width: 100},
  ];

  const tableData = useMemo(() => {
    if (!data?.data) {
      return [];
    }
    return data.data.map((flag: any) => [
      {value: {key: flag.key, text: flag.key}},
      {value: flag.description || ""},
      {value: flag.flagType},
      {value: {enabled: flag.enabled, onToggle: () => handleToggle(flag.key, !flag.enabled)}},
      {value: flag.status},
    ]);
  }, [data, handleToggle]);

  if (error) {
    return (
      <Page title="Feature Flags">
        <Text color="error">Failed to load flags</Text>
      </Page>
    );
  }

  return (
    <Page title="Feature Flags">
      <Box gap={4} padding={4}>
        <Box alignItems="center" direction="row" gap={4}>
          <SelectField
            onChange={setStatusFilter}
            options={[
              {label: "Active", value: "active"},
              {label: "Archived", value: "archived"},
              {label: "All", value: ""},
            ]}
            title="Status"
            value={statusFilter}
          />
        </Box>
        {isLoading ? (
          <Box alignItems="center" padding={6}>
            <Spinner />
          </Box>
        ) : tableData.length === 0 ? (
          <Box alignItems="center" padding={6}>
            <Text color="secondaryDark">No flags found.</Text>
          </Box>
        ) : (
          <DataTable
            columns={columns}
            customColumnComponentMap={customColumnComponentMap}
            data={tableData}
          />
        )}
      </Box>
    </Page>
  );
};
