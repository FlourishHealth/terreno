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
  Modal,
  Page,
  printDateAndTime,
  SelectField,
  Spinner,
  Text,
  TextField,
  useToast,
} from "@terreno/ui";
import type {Href} from "expo-router";
import {router, useNavigation} from "expo-router";
import startCase from "lodash/startCase";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Pressable} from "react-native";
import {
  ADMIN_LIST_MAX_SELECTION,
  type AdminListFilterState,
  buildAdminListQueryParams,
} from "./adminModelListQueryParams";
import {
  type AdminApi,
  type AdminFieldConfig,
  type AdminFieldValue,
  type AdminModelConfig,
  resolveAdminBases,
} from "./types";
import {useAdminApi} from "./useAdminApi";
import {useAdminBackgroundTaskMutation} from "./useAdminBackgroundTask";
import {useAdminConfig} from "./useAdminConfig";

interface AdminModelTableProps {
  /** @deprecated Use `apiBase`/`routeBase`. Kept as a backward-compatible alias. */
  baseUrl?: string;
  /** Base path where admin API requests are sent. Falls back to `baseUrl`. */
  apiBase?: string;
  /** Base path used for in-app navigation. Falls back to `baseUrl`. */
  routeBase?: string;
  api: AdminApi;
  modelName: string;
  columns?: string[];
  /**
   * Optional pixel widths for individual list columns, keyed by field name. Falls
   * back to {@link AdminModelConfig.listColumnWidths} from the backend, then to the
   * built-in column-type defaults. Useful when the default heuristics pick the wrong
   * width for a given model.
   */
  columnWidths?: Record<string, number>;
}

const ACTIONS_COLUMN_TYPE = "adminActions";
const LINK_COLUMN_TYPE = "adminLink";
const SELECT_COLUMN_TYPE = "adminSelect";
const INLINE_BOOL_COLUMN_TYPE = "adminInlineBool";
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

const formatCellValue = (value: AdminFieldValue, columnType: string): string => {
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
    return (value as {_id?: string})._id ?? JSON.stringify(value);
  }
  return String(value);
};

const buildSortString = (
  sort: ColumnSortInterface | undefined,
  displayFields: string[]
): string | undefined => {
  if (!sort) {
    return undefined;
  }
  const fieldKey = displayFields[sort.column];
  if (!fieldKey) {
    return undefined;
  }
  return sort.direction === "desc" ? `-${fieldKey}` : fieldKey;
};

const AdminLinkCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {text, href} = cellData.value as {text: string; href: string};
  return <Link onClick={() => router.push(href as Href)} text={text} />;
};

const AdminActionsCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {id, baseUrl, modelName, onDelete, deleteEnabled} = cellData.value as {
    id: string;
    baseUrl: string;
    modelName: string;
    onDelete: (id: string) => void;
    deleteEnabled: boolean;
  };
  const href = `${baseUrl}/${modelName}/${id}`;
  return (
    <Box alignItems="center" direction="row" gap={1} justifyContent="end">
      <IconButton
        accessibilityLabel="View"
        iconName="eye"
        onClick={() => router.push(href as Href)}
        tooltipText="View"
        variant="muted"
      />
      <IconButton
        accessibilityLabel="Edit"
        iconName="pen-to-square"
        onClick={() => router.push(href as Href)}
        tooltipText="Edit"
        variant="muted"
      />
      {deleteEnabled ? (
        <IconButton
          accessibilityLabel="Delete"
          confirmationText="Are you sure you want to delete this item?"
          iconName="trash"
          onClick={() => onDelete(id)}
          tooltipText="Delete"
          variant="destructive"
          withConfirmation
        />
      ) : null}
    </Box>
  );
};

const AdminSelectCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {id, selected, onToggle} = cellData.value as {
    id: string;
    onToggle: (id: string, next: boolean) => void;
    selected: boolean;
  };
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{checked: selected}}
      onPress={() => onToggle(id, !selected)}
    >
      <Box alignItems="center" justifyContent="center" padding={1}>
        <Text size="lg">{selected ? "\u2611" : "\u2610"}</Text>
      </Box>
    </Pressable>
  );
};

const AdminInlineBoolCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {value, disabled, onToggle} = cellData.value as {
    disabled: boolean;
    onToggle: () => void;
    value: boolean;
  };
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked: Boolean(value), disabled}}
      disabled={disabled}
      onPress={() => !disabled && onToggle()}
    >
      <Box alignItems="center" justifyContent="center" padding={1}>
        <Text color={value ? "success" : "secondaryDark"} size="lg">
          {value ? "\u2713" : "\u2014"}
        </Text>
      </Box>
    </Pressable>
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
 * Table view for a specific admin model with pagination, sorting, filters, search,
 * optional bulk actions, and CRUD row actions.
 */
export const AdminModelTable: React.FC<AdminModelTableProps> = ({
  baseUrl,
  apiBase,
  routeBase,
  api,
  modelName,
  columns: columnsProp,
  columnWidths,
}) => {
  const {apiBase: resolvedApiBase, routeBase: resolvedRouteBase} = resolveAdminBases({
    apiBase,
    baseUrl,
    routeBase,
  });
  const {config, isLoading: isConfigLoading} = useAdminConfig(api, resolvedApiBase);
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<ColumnSortInterface | undefined>();
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterState, setFilterState] = useState<AdminListFilterState>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmActionId, setConfirmActionId] = useState<string | null>(null);
  const navigation = useNavigation();

  const modelConfig: AdminModelConfig | undefined = useMemo(
    () => config?.models.find((m: AdminModelConfig) => m.name === modelName),
    [config, modelName]
  );

  // Debounce search text for list queries.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => {
      clearTimeout(t);
    };
  }, [searchText]);

  // Reset filter UI when switching models.
  useEffect(() => {
    if (!modelConfig) {
      return;
    }
    const next: AdminListFilterState = {};
    for (const f of modelConfig.filters ?? []) {
      if (f.kind === "boolean") {
        next[f.field] = undefined;
      } else if (f.kind === "dateRange") {
        next[`${f.field}_gte`] = "";
        next[`${f.field}_lte`] = "";
      } else {
        next[f.field] = "";
      }
    }
    setFilterState(next);
    setSelectedIds(new Set());
    setPage(1);
    setSearchText("");
    setDebouncedSearch("");
  }, [modelConfig]);

  const displayFields = useMemo(
    () => columnsProp ?? modelConfig?.listDisplay ?? modelConfig?.listFields ?? [],
    [columnsProp, modelConfig]
  );

  const linkFieldSet = useMemo(() => {
    const links = modelConfig?.listDisplayLinks;
    if (links && links.length > 0) {
      return new Set(links);
    }
    const first = displayFields[0];
    return new Set(first ? [first] : []);
  }, [displayFields, modelConfig?.listDisplayLinks]);

  const sortableFieldSet = useMemo(() => {
    const sf = modelConfig?.sortableFields;
    if (!sf || sf.length === 0) {
      return undefined;
    }
    return new Set(sf);
  }, [modelConfig?.sortableFields]);

  const pageLimit = modelConfig?.pageSize ?? 20;

  const sortString = useMemo(
    () => buildSortString(sortColumn, displayFields) ?? modelConfig?.defaultSort,
    [sortColumn, displayFields, modelConfig]
  );

  const listParams = useMemo(() => {
    if (!modelConfig) {
      return undefined;
    }
    return buildAdminListQueryParams({
      filterState,
      limit: pageLimit,
      modelConfig,
      page,
      searchDebounced: debouncedSearch,
      sort: sortString,
    });
  }, [debouncedSearch, filterState, modelConfig, page, pageLimit, sortString]);

  const {useListQuery, useDeleteMutation, useUpdateMutation, useBulkPatchMutation} = useAdminApi(
    api,
    modelConfig?.routePath ?? "",
    modelName
  );
  const {data: listData, isLoading: isListLoading} = useListQuery(listParams, {skip: !modelConfig});
  const [deleteItem] = useDeleteMutation();
  const [patchItem] = useUpdateMutation();
  const [bulkPatch] = useBulkPatchMutation();
  const [enqueueBackground] = useAdminBackgroundTaskMutation(api, resolvedApiBase);

  const deleteEnabled = modelConfig?.permissions?.delete !== false;
  const createEnabled = modelConfig?.permissions?.create !== false;
  const showSelectColumn = Boolean(modelConfig?.actions?.length);

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

  const toggleSelected = useCallback(
    (id: string, next: boolean) => {
      setSelectedIds((prev) => {
        const n = new Set(prev);
        if (next) {
          if (n.size >= ADMIN_LIST_MAX_SELECTION) {
            toast.warn(`You can select at most ${ADMIN_LIST_MAX_SELECTION} rows.`);
            return prev;
          }
          n.add(id);
        } else {
          n.delete(id);
        }
        return n;
      });
    },
    [toast]
  );

  const toggleSelectPage = useCallback(() => {
    const ids = (listData?.data ?? []).map((row: {_id?: string}) => String(row._id));
    const allSelected = ids.length > 0 && ids.every((id: string) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const n = new Set(prev);
        for (const id of ids) {
          n.delete(id);
        }
        return n;
      });
      return;
    }
    setSelectedIds((prev) => {
      const n = new Set(prev);
      for (const id of ids) {
        if (n.size >= ADMIN_LIST_MAX_SELECTION) {
          break;
        }
        n.add(id);
      }
      if (ids.length > ADMIN_LIST_MAX_SELECTION) {
        toast.warn(`Only the first ${ADMIN_LIST_MAX_SELECTION} rows on this page can be selected.`);
      }
      return n;
    });
  }, [listData?.data, selectedIds, toast]);

  const runBulkAction = useCallback(
    async (actionId: string) => {
      if (!modelConfig) {
        return;
      }
      const action = modelConfig.actions?.find((a) => a.id === actionId);
      if (!action) {
        return;
      }
      const ids = [...selectedIds];
      if (ids.length === 0) {
        return;
      }
      try {
        if (action.background) {
          await enqueueBackground({
            ids,
            kind: action.id,
            metadata: {actionId: action.id},
            resourceRoute: modelConfig.routePath,
          }).unwrap();
          toast.success("Background task queued");
        } else if (action.patchKeys && action.patchKeys.length > 0) {
          const patch: Record<string, unknown> = {};
          for (const k of action.patchKeys) {
            patch[k] = true;
          }
          await bulkPatch({ids, patch}).unwrap();
          toast.success("Bulk update applied");
        } else {
          toast.warn("This action has no bulk handler configured.");
        }
        setSelectedIds(new Set());
        setConfirmActionId(null);
      } catch (err) {
        toast.catch(err, "Bulk action failed");
      }
    },
    [bulkPatch, enqueueBackground, modelConfig, selectedIds, toast]
  );

  const handleInlineBooleanToggle = useCallback(
    async (rowId: string, fieldKey: string, next: boolean) => {
      try {
        await patchItem({body: {[fieldKey]: next}, id: rowId}).unwrap();
      } catch (err) {
        toast.catch(err, "Update failed");
      }
    },
    [patchItem, toast]
  );

  useEffect(() => {
    if (!modelConfig) {
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <Box alignItems="center" justifyContent="center" marginRight={3}>
          {createEnabled ? (
            <Button
              onClick={() => router.push(`${resolvedRouteBase}/${modelName}/create` as Href)}
              testID="admin-create-button"
              text="Create"
              variant="primary"
            />
          ) : null}
        </Box>
      ),
      title: modelConfig.displayName,
    });
  }, [createEnabled, navigation, modelConfig, resolvedRouteBase, modelName]);

  const customColumnComponentMap: DataTableCustomComponentMap = useMemo(
    () => ({
      [ACTIONS_COLUMN_TYPE]: AdminActionsCell,
      [INLINE_BOOL_COLUMN_TYPE]: AdminInlineBoolCell,
      [LINK_COLUMN_TYPE]: AdminLinkCell,
      [SELECT_COLUMN_TYPE]: AdminSelectCell,
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

  const dataColumns: DataTableColumn[] = displayFields.map((fieldKey) => {
    const fieldConfig = modelConfig.fields[fieldKey];
    const columnType = getColumnType(fieldKey, fieldConfig);
    const widthOverride = columnWidths?.[fieldKey] ?? modelConfig.listColumnWidths?.[fieldKey];
    const sortable =
      sortableFieldSet === undefined ? true : Boolean(sortableFieldSet.has(fieldKey));
    const isLink = linkFieldSet.has(fieldKey);
    const isInlineBool =
      fieldConfig?.type === "boolean" && modelConfig.permissions?.update !== false;
    return {
      columnType: isInlineBool ? INLINE_BOOL_COLUMN_TYPE : isLink ? LINK_COLUMN_TYPE : columnType,
      sortable,
      title: startCase(fieldKey),
      width: widthOverride ?? getColumnWidth(fieldKey, columnType),
    };
  });

  const selectColumn: DataTableColumn | null = showSelectColumn
    ? {
        columnType: SELECT_COLUMN_TYPE,
        sortable: false,
        title: "",
        width: 48,
      }
    : null;

  const columns: DataTableColumn[] = [
    ...(selectColumn ? [selectColumn] : []),
    ...dataColumns,
    {
      columnType: ACTIONS_COLUMN_TYPE,
      sortable: false,
      title: "",
      width: deleteEnabled ? 140 : 100,
    },
  ];

  const listItems = (listData?.data ?? []) as Array<Record<string, AdminFieldValue>>;
  const data = listItems.map((item) => {
    const id = String(item._id ?? "");
    const selected = selectedIds.has(id);
    const selectCell = selectColumn ? [{value: {id, onToggle: toggleSelected, selected}}] : [];

    const fieldCells = displayFields.map((fieldKey) => {
      const fieldConfig = modelConfig.fields[fieldKey];
      const columnType = getColumnType(fieldKey, fieldConfig);
      const formatted = formatCellValue(item[fieldKey], columnType);
      const isLink = linkFieldSet.has(fieldKey);
      const isInlineBool =
        fieldConfig?.type === "boolean" && modelConfig.permissions?.update !== false;

      if (isInlineBool) {
        return {
          value: {
            disabled: modelConfig.permissions?.update === false,
            onToggle: () => handleInlineBooleanToggle(id, fieldKey, !item[fieldKey]),
            value: Boolean(item[fieldKey]),
          },
        };
      }

      if (isLink) {
        return {
          value: {
            href: `${resolvedRouteBase}/${modelName}/${item._id}`,
            text: formatted,
          },
        };
      }

      return {
        value: formatted,
      };
    });

    const actionsCell = {
      value: {
        baseUrl: resolvedRouteBase,
        deleteEnabled,
        id,
        modelName,
        onDelete: handleDelete,
      },
    };
    return [...selectCell, ...fieldCells, actionsCell];
  });

  const totalPages = listData ? Math.ceil((listData.total as number) / pageLimit) : 1;

  const pendingAction = modelConfig.actions?.find((a) => a.id === confirmActionId);

  return (
    <Page maxWidth="100%">
      <Box gap={3} padding={4} testID={`admin-list-${modelName}`}>
        <Box direction="row" gap={3} wrap>
          {modelConfig.searchFields && modelConfig.searchFields.length > 0 ? (
            <Box maxWidth={360} minWidth={200}>
              <TextField
                helperText={`Filter by ${modelConfig.searchFields[0]} (exact match)`}
                onChange={setSearchText}
                title="Search"
                value={searchText}
              />
            </Box>
          ) : null}
          {(modelConfig.filters ?? []).map((f) => {
            if (f.kind === "boolean") {
              const v = filterState[f.field];
              return (
                <Box key={f.field} minWidth={160}>
                  <SelectField
                    onChange={(next: string) => {
                      setFilterState((prev) => ({...prev, [f.field]: next}));
                      setPage(1);
                    }}
                    options={[
                      {label: f.label ?? startCase(f.field), value: "all"},
                      {label: "Yes", value: "true"},
                      {label: "No", value: "false"},
                    ]}
                    title={f.label ?? startCase(f.field)}
                    value={v === true ? "true" : v === false ? "false" : "all"}
                  />
                </Box>
              );
            }
            if (f.kind === "dateRange") {
              const gteKey = `${f.field}_gte`;
              const lteKey = `${f.field}_lte`;
              return (
                <Box direction="row" gap={2} key={f.field} wrap>
                  <Box minWidth={160}>
                    <TextField
                      helperText="ISO date or datetime"
                      onChange={(next: string) => {
                        setFilterState((prev) => ({...prev, [gteKey]: next}));
                        setPage(1);
                      }}
                      title={`${f.label ?? startCase(f.field)} from`}
                      value={String(filterState[gteKey] ?? "")}
                    />
                  </Box>
                  <Box minWidth={160}>
                    <TextField
                      helperText="ISO date or datetime"
                      onChange={(next: string) => {
                        setFilterState((prev) => ({...prev, [lteKey]: next}));
                        setPage(1);
                      }}
                      title={`${f.label ?? startCase(f.field)} to`}
                      value={String(filterState[lteKey] ?? "")}
                    />
                  </Box>
                </Box>
              );
            }
            if (f.kind === "choice") {
              return (
                <Box key={f.field} minWidth={180}>
                  <SelectField
                    onChange={(next: string) => {
                      setFilterState((prev) => ({
                        ...prev,
                        [f.field]: next === "__all__" ? "" : next,
                      }));
                      setPage(1);
                    }}
                    options={[
                      {label: "All", value: "__all__"},
                      ...((f.choices ?? []) as {label: string; value: string}[]).map((c) => ({
                        label: c.label,
                        value: c.value,
                      })),
                    ]}
                    title={f.label ?? startCase(f.field)}
                    value={String(filterState[f.field] ?? "__all__")}
                  />
                </Box>
              );
            }
            return (
              <Box key={f.field} minWidth={160}>
                <TextField
                  onChange={(next: string) => {
                    setFilterState((prev) => ({...prev, [f.field]: next}));
                    setPage(1);
                  }}
                  title={f.label ?? startCase(f.field)}
                  value={String(filterState[f.field] ?? "")}
                />
              </Box>
            );
          })}
        </Box>

        {selectColumn ? (
          <Box alignItems="center" direction="row" gap={3} testID="bulk-action">
            <Button onClick={toggleSelectPage} text="Toggle page selection" variant="outline" />
            {modelConfig.actions && modelConfig.actions.length > 0 ? (
              <SelectField
                onChange={(next: string) => {
                  if (next === "__none__" || !next) {
                    return;
                  }
                  const act = modelConfig.actions?.find((a) => a.id === next);
                  if (!act) {
                    return;
                  }
                  if (act.confirm) {
                    setConfirmActionId(act.id);
                  } else {
                    void runBulkAction(act.id);
                  }
                }}
                options={[
                  {label: "Bulk actions\u2026", value: "__none__"},
                  ...modelConfig.actions.map((a) => ({label: a.label, value: a.id})),
                ]}
                title="Actions"
                value="__none__"
              />
            ) : null}
            <Text color="secondaryDark" size="sm">
              {selectedIds.size} selected
            </Text>
          </Box>
        ) : null}

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
            pinnedColumns={selectColumn ? 1 : 0}
            setPage={setPage}
            setSortColumn={setSortColumn}
            sortColumn={sortColumn}
            totalPages={totalPages}
          />
        )}
      </Box>

      <Modal
        onDismiss={() => setConfirmActionId(null)}
        primaryButtonOnClick={() => {
          if (confirmActionId) {
            void runBulkAction(confirmActionId);
          }
        }}
        primaryButtonText="Continue"
        secondaryButtonOnClick={() => setConfirmActionId(null)}
        secondaryButtonText="Cancel"
        title="Confirm bulk action"
        visible={Boolean(pendingAction?.confirm)}
      >
        <Text>{pendingAction?.confirm}</Text>
      </Modal>
    </Page>
  );
};
