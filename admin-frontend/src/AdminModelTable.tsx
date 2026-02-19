import type {Api} from "@reduxjs/toolkit/query/react";
import {
  Box,
  Button,
  type ColumnSortInterface,
  DataTable,
  type DataTableColumn,
  Page,
  Spinner,
  Text,
} from "@terreno/ui";
import {router} from "expo-router";
import startCase from "lodash/startCase";
import {DateTime} from "luxon";
import React, {useCallback, useMemo, useState} from "react";
import type {AdminFieldConfig, AdminModelConfig} from "./types";
import {useAdminApi} from "./useAdminApi";
import {useAdminConfig} from "./useAdminConfig";

interface AdminModelTableProps {
  baseUrl: string;
  api: Api<any, any, any, any>;
  modelName: string;
}

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

export const AdminModelTable: React.FC<AdminModelTableProps> = ({baseUrl, api, modelName}) => {
  const {config, isLoading: isConfigLoading} = useAdminConfig(api, baseUrl);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<ColumnSortInterface | undefined>();

  const modelConfig: AdminModelConfig | undefined = useMemo(
    () => config?.models.find((m: AdminModelConfig) => m.name === modelName),
    [config, modelName]
  );

  const sortString = useMemo(
    () => buildSortString(sortColumn, modelConfig?.listFields ?? []) ?? modelConfig?.defaultSort,
    [sortColumn, modelConfig]
  );

  const {useListQuery} = useAdminApi(api, modelConfig?.routePath ?? "", modelName);
  const {data: listData, isLoading: isListLoading} = useListQuery(
    {limit: DEFAULT_LIMIT, page, sort: sortString},
    {skip: !modelConfig}
  );

  const handleCreate = useCallback(() => {
    router.push(`./${modelName}/create`);
  }, [modelName]);

  if (isConfigLoading || !modelConfig) {
    return (
      <Page navigation={null} title="Loading...">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  const columns: DataTableColumn[] = modelConfig.listFields.map((fieldKey) => {
    const fieldConfig = modelConfig.fields[fieldKey];
    return {
      columnType: fieldConfig ? mapFieldTypeToColumnType(fieldConfig) : "text",
      sortable: true,
      title: startCase(fieldKey),
      width: fieldConfig ? getColumnWidth(fieldKey, fieldConfig) : 200,
    };
  });

  const data = (listData?.data ?? []).map((item: any) =>
    modelConfig.listFields.map((fieldKey) => {
      const fieldConfig = modelConfig.fields[fieldKey];
      return {
        value: fieldConfig
          ? formatCellValue(item[fieldKey], fieldConfig)
          : String(item[fieldKey] ?? ""),
      };
    })
  );

  const totalPages = listData ? Math.ceil(listData.total / DEFAULT_LIMIT) : 1;

  return (
    <Page
      backButton
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
      navigation={null}
      title={modelConfig.displayName}
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
