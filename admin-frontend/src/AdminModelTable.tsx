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
  printDateAndTime,
  Spinner,
  Text,
} from "@terreno/ui";
import {router, useNavigation} from "expo-router";
import startCase from "lodash/startCase";
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
const DATE_FIELD_NAMES = new Set(["created", "updated", "deleted"]);

const getColumnType = (fieldKey: string, fieldConfig?: AdminFieldConfig): string => {
  if (fieldConfig) {
    if (fieldConfig.type === "boolean") {
      return "boolean";
    }
    if (fieldConfig.type === "number") {
      return "number";
    }
    if (fieldConfig.type === "date" || fieldConfig.type === "datetime") {
      return "date";
    }
  }
  if (DATE_FIELD_NAMES.has(fieldKey)) {
    return "date";
  }
  return "text";
};

const getColumnWidth = (fieldKey: string, columnType: string): number => {
  if (columnType === "boolean") {
    return 100;
  }
  if (columnType === "number") {
    return 120;
  }
  if (columnType === "date") {
    return 180;
  }
  if (fieldKey === "_id") {
    return 240;
  }
  return 200;
};

const formatCellValue = (value: any, columnType: string): string => {
  if (value == null) {
    return "";
  }
  if (columnType === "boolean") {
    return value ? "\u2713" : "";
  }
  if (columnType === "date") {
    return printDateAndTime(String(value), {defaultValue: String(value)});
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
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

const AdminActionsCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {id, baseUrl, modelName, onDelete} = cellData.value as {
    id: string;
    baseUrl: string;
    modelName: string;
    onDelete: (id: string) => void;
  };
  const href = `${baseUrl}/${modelName}/${id}`;
  return (
    <Box alignItems="center" direction="row" gap={1} justifyContent="end">
      <IconButton
        accessibilityLabel="View"
        iconName="eye"
        onClick={() => router.push(href as any)}
        tooltipText="View"
        variant="muted"
      />
      <IconButton
        accessibilityLabel="Edit"
        iconName="pen-to-square"
        onClick={() => router.push(href as any)}
        tooltipText="Edit"
        variant="muted"
      />
      <IconButton
        accessibilityLabel="Delete"
        confirmationText="Are you sure you want to delete this item?"
        iconName="trash"
        onClick={() => onDelete(id)}
        tooltipText="Delete"
        variant="destructive"
        withConfirmation
      />
    </Box>
  );
};

const LoadingContent: React.FC = () => (
  <Box alignItems="center" justifyContent="center" padding={6}>
    <Spinner />
  </Box>
);

const EmptyContent: React.FC = () => (
  <Box alignItems="center" padding={6}>
    <Text color="secondaryDark">No items found.</Text>
  </Box>
);

/**
 * Table view for a specific admin model with pagination, sorting, and CRUD actions.
 *
 * Displays model data in a DataTable with columns from the model's `listFields` configuration.
 * Provides actions for creating new items, editing existing items, and deleting items.
 * Supports pagination, sorting, and reference field rendering as clickable links.
 *
 * @param props - Component props
 * @param props.baseUrl - Base URL for admin routes (e.g., "/admin")
 * @param props.api - RTK Query API instance for making authenticated requests
 * @param props.modelName - Name of the model to display (e.g., "User")
 * @param props.columns - Optional array of field names to display. Defaults to model's listFields.
 *
 * @example
 * ```typescript
 * import {AdminModelTable} from "@terreno/admin-frontend";
 * import {api} from "@/store/openApiSdk";
 * import {useLocalSearchParams} from "expo-router";
 *
 * function AdminModelScreen() {
 *   const {modelName} = useLocalSearchParams();
 *   return <AdminModelTable baseUrl="/admin" api={api} modelName={modelName as string} />;
 * }
 * ```
 *
 * @see AdminModelForm for the create/edit form
 * @see AdminModelList for the model list screen
 * @see useAdminApi for the CRUD API hooks
 */
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

  useEffect(() => {
    if (!modelConfig) {
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Box paddingX={4} paddingY={2}>
          <Button
            onClick={() => router.push(`${baseUrl}/${modelName}/create` as any)}
            testID="admin-create-button"
            text="Create"
            variant="primary"
          />
        </Box>
      ),
      title: modelConfig.displayName,
    });
  }, [navigation, modelConfig, baseUrl, modelName]);

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

  const customColumnComponentMap: DataTableCustomComponentMap = useMemo(
    () => ({
      [ACTIONS_COLUMN_TYPE]: AdminActionsCell,
      [LINK_COLUMN_TYPE]: AdminLinkCell,
    }),
    []
  );

  if (isConfigLoading || !modelConfig) {
    return (
      <Page maxWidth="100%">
        <LoadingContent />
      </Page>
    );
  }

  const dataColumns: DataTableColumn[] = displayFields.map((fieldKey, index) => {
    const fieldConfig = modelConfig.fields[fieldKey];
    const isFirst = index === 0;
    const columnType = getColumnType(fieldKey, fieldConfig);
    return {
      columnType: isFirst ? LINK_COLUMN_TYPE : columnType,
      sortable: true,
      title: startCase(fieldKey),
      width: getColumnWidth(fieldKey, columnType),
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
      const columnType = getColumnType(fieldKey, fieldConfig);
      const formatted = formatCellValue(item[fieldKey], columnType);

      if (isFirst) {
        return {
          value: {
            href: `${baseUrl}/${modelName}/${item._id}`,
            text: formatted,
          },
        };
      }

      return {
        value: formatted,
      };
    });

    const actionsCell = {value: {baseUrl, id: item._id, modelName, onDelete: handleDelete}};
    return [...fieldCells, actionsCell];
  });

  const totalPages = listData ? Math.ceil(listData.total / DEFAULT_LIMIT) : 1;

  return (
    <Page maxWidth="100%">
      {isListLoading ? (
        <LoadingContent />
      ) : data.length === 0 ? (
        <EmptyContent />
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
