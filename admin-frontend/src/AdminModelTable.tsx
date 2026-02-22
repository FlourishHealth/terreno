import type {Api} from "@reduxjs/toolkit/query/react";
import {
  Box,
  Button,
  type ColumnSortInterface,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  type DataTableCustomComponentMap,
  IconButton,
  Link,
  Page,
  Spinner,
  Text,
} from "@terreno/ui";
import {router, useNavigation} from "expo-router";
import startCase from "lodash/startCase";
import {DateTime} from "luxon";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import type {AdminFieldConfig, AdminModelConfig} from "./types";
import {useAdminApi} from "./useAdminApi";
import {useAdminConfig} from "./useAdminConfig";

interface AdminModelTableProps {
  baseUrl: string;
  api: Api<any, any, any, any>;
  modelName: string;
  columns?: string[];
}

const ACTIONS_COLUMN_TYPE = "adminActions";
const LINK_COLUMN_TYPE = "adminLink";
const DEFAULT_LIMIT = 20;

const mapFieldTypeToColumnType = (fieldConfig: AdminFieldConfig): string => {
  if (fieldConfig.type === "boolean") {
    return "boolean";
  }
  if (fieldConfig.type === "number") {
    return "number";
  }
  if (fieldConfig.type === "date" || fieldConfig.type === "datetime") {
    return "date";
  }
  return "text";
};

const getColumnWidth = (fieldKey: string, fieldConfig: AdminFieldConfig): number => {
  if (fieldConfig.type === "boolean") {
    return 100;
  }
  if (fieldConfig.type === "number") {
    return 120;
  }
  if (fieldConfig.type === "date" || fieldConfig.type === "datetime") {
    return 180;
  }
  if (fieldKey === "_id") {
    return 240;
  }
  return 200;
};

const formatCellValue = (value: any, fieldConfig: AdminFieldConfig): string => {
  if (value == null) {
    return "";
  }
  if (fieldConfig.type === "boolean") {
    return value ? "\u2713" : "";
  }
  if (fieldConfig.type === "date" || fieldConfig.type === "datetime") {
    const dt = DateTime.fromISO(String(value));
    return dt.isValid ? dt.toLocaleString(DateTime.DATETIME_SHORT) : String(value);
  }
  if (typeof value === "object") {
    return value._id ?? JSON.stringify(value);
  }
  return String(value);
};

const buildSortString = (
  sort: ColumnSortInterface | undefined,
  listFields: string[]
): string | undefined => {
  if (!sort) {
    return undefined;
  }
  const fieldKey = listFields[sort.column];
  if (!fieldKey) {
    return undefined;
  }
  return sort.direction === "desc" ? `-${fieldKey}` : fieldKey;
};

const AdminLinkCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {text, href} = cellData.value as {text: string; href: string};
  return <Link onClick={() => router.push(href as any)} text={text} />;
};

export const AdminModelTable: React.FC<AdminModelTableProps> = ({
  baseUrl,
  api,
  modelName,
  columns: columnsProp,
}) => {
  const {config, isLoading: isConfigLoading} = useAdminConfig(api, baseUrl);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<ColumnSortInterface | undefined>();
  const navigation = useNavigation();

  const modelConfig: AdminModelConfig | undefined = useMemo(
    () => config?.models.find((m: AdminModelConfig) => m.name === modelName),
    [config, modelName]
  );

  // Set the navigation header title to the model display name
  useEffect(() => {
    if (!modelConfig) {
      return;
    }
    navigation.setOptions({title: modelConfig.displayName});
  }, [navigation, modelConfig]);

  const displayFields = useMemo(
    () => columnsProp ?? modelConfig?.listFields ?? [],
    [columnsProp, modelConfig]
  );

  const sortString = useMemo(
    () => buildSortString(sortColumn, displayFields) ?? modelConfig?.defaultSort,
    [sortColumn, displayFields, modelConfig]
  );

  const {useListQuery, useDeleteMutation} = useAdminApi(
    api,
    modelConfig?.routePath ?? "",
    modelName
  );
  const {data: listData, isLoading: isListLoading} = useListQuery(
    {limit: DEFAULT_LIMIT, page, sort: sortString},
    {skip: !modelConfig}
  );
  const [deleteItem] = useDeleteMutation();

  const handleCreate = useCallback(() => {
    router.push(`${baseUrl}/${modelName}/create` as any);
  }, [baseUrl, modelName]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteItem(id).unwrap();
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    },
    [deleteItem]
  );

  const AdminActionsCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> =
    useCallback(
      ({cellData}: {column: DataTableColumn; cellData: DataTableCellData}) => {
        const {id} = cellData.value as {id: string};
        const viewHref = `${baseUrl}/${modelName}/${id}`;
        const editHref = `${baseUrl}/${modelName}/${id}`;
        return (
          <Box alignItems="center" direction="row" gap={1} justifyContent="end">
            <IconButton
              accessibilityLabel="View"
              iconName="eye"
              onClick={() => router.push(viewHref as any)}
              tooltipText="View"
              variant="muted"
            />
            <IconButton
              accessibilityLabel="Edit"
              iconName="pen-to-square"
              onClick={() => router.push(editHref as any)}
              tooltipText="Edit"
              variant="muted"
            />
            <IconButton
              accessibilityLabel="Delete"
              confirmationText="Are you sure you want to delete this item?"
              iconName="trash"
              onClick={() => handleDelete(id)}
              tooltipText="Delete"
              variant="destructive"
              withConfirmation
            />
          </Box>
        );
      },
      [baseUrl, modelName, handleDelete]
    );

  const customColumnComponentMap: DataTableCustomComponentMap = useMemo(
    () => ({
      [ACTIONS_COLUMN_TYPE]: AdminActionsCell,
      [LINK_COLUMN_TYPE]: AdminLinkCell,
    }),
    [AdminActionsCell]
  );

  if (isConfigLoading || !modelConfig) {
    return (
      <Page maxWidth="100%">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  const dataColumns: DataTableColumn[] = displayFields.map((fieldKey, index) => {
    const fieldConfig = modelConfig.fields[fieldKey];
    const isFirst = index === 0;
    return {
      columnType: isFirst
        ? LINK_COLUMN_TYPE
        : fieldConfig
          ? mapFieldTypeToColumnType(fieldConfig)
          : "text",
      sortable: true,
      title: startCase(fieldKey),
      width: fieldConfig ? getColumnWidth(fieldKey, fieldConfig) : 200,
    };
  });

  const columns: DataTableColumn[] = [
    ...dataColumns,
    {
      columnType: ACTIONS_COLUMN_TYPE,
      sortable: false,
      title: "",
      width: 140,
    },
  ];

  const data = (listData?.data ?? []).map((item: any) => {
    const fieldCells = displayFields.map((fieldKey, index) => {
      const fieldConfig = modelConfig.fields[fieldKey];
      const isFirst = index === 0;

      if (isFirst) {
        const displayText = fieldConfig
          ? formatCellValue(item[fieldKey], fieldConfig)
          : String(item[fieldKey] ?? "");
        return {
          value: {
            href: `${baseUrl}/${modelName}/${item._id}`,
            text: displayText,
          },
        };
      }

      return {
        value: fieldConfig
          ? formatCellValue(item[fieldKey], fieldConfig)
          : String(item[fieldKey] ?? ""),
      };
    });

    const actionsCell = {value: {id: item._id}};
    return [...fieldCells, actionsCell];
  });

  const totalPages = listData ? Math.ceil(listData.total / DEFAULT_LIMIT) : 1;

  return (
    <Page
      footer={
        <Box direction="row" justifyContent="end" padding={2}>
          <Button
            onClick={handleCreate}
            testID="admin-create-button"
            text="Create"
            variant="primary"
          />
        </Box>
      }
      maxWidth="100%"
    >
      {isListLoading ? (
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      ) : data.length === 0 ? (
        <Box alignItems="center" padding={6}>
          <Text color="secondaryDark">No items found.</Text>
        </Box>
      ) : (
        <DataTable
          columns={columns}
          customColumnComponentMap={customColumnComponentMap}
          data={data}
          page={page}
          setPage={setPage}
          setSortColumn={setSortColumn}
          sortColumn={sortColumn}
          totalPages={totalPages}
        />
      )}
    </Page>
  );
};
