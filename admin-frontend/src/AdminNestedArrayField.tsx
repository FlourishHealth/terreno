import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Button, Card, DraggableList, Heading, IconButton, Text} from "@terreno/ui";
import React, {useCallback, useMemo, useRef} from "react";
import {AdminFieldRenderer} from "./AdminFieldRenderer";
import type {AdminFieldConfig} from "./types";

const FIELD_HEIGHT_ESTIMATE = 76;
const CARD_HEADER_HEIGHT = 44;
const CARD_PADDING = 24;
const ITEMS_GAP = 8;

interface AdminNestedArrayFieldProps {
  title: string;
  helperText?: string;
  errorText?: string;
  items: Record<string, AdminFieldConfig>;
  value: Record<string, any>[];
  onChange: (value: Record<string, any>[]) => void;
  api: Api<any, any, any, any>;
  baseUrl: string;
  modelConfigs?: Array<{name: string; routePath: string}>;
  /** Parent document form state, used to derive dynamic options for sub-fields */
  parentFormState?: Record<string, any>;
}

const buildDefaultItem = (items: Record<string, AdminFieldConfig>): Record<string, any> => {
  const newItem: Record<string, any> = {};
  for (const [key, config] of Object.entries(items)) {
    if (config.default != null) {
      newItem[key] = config.default;
    } else if (config.type === "boolean") {
      newItem[key] = false;
    } else if (config.type === "number") {
      newItem[key] = 0;
    } else if (config.type === "array") {
      newItem[key] = [];
    } else {
      newItem[key] = "";
    }
  }
  return newItem;
};

/**
 * Renders an editable, drag-and-drop reorderable list of sub-document objects.
 * Each array item is shown as a Card with the standard admin field renderers,
 * and a drag grip for reordering via DraggableList.
 */
export const AdminNestedArrayField: React.FC<AdminNestedArrayFieldProps> = ({
  title,
  helperText,
  errorText,
  items,
  value,
  onChange,
  api,
  baseUrl,
  modelConfigs,
  parentFormState,
}) => {
  const arrayValue = useMemo((): Record<string, any>[] => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  const subFieldCount = Object.keys(items).length;
  const itemHeight = CARD_HEADER_HEIGHT + subFieldCount * FIELD_HEIGHT_ESTIMATE + CARD_PADDING;

  // Stable ID counter so new items get unique IDs across the component lifetime
  const nextIdRef = useRef(arrayValue.length);

  // Maintain a parallel array of stable string IDs for DraggableList
  const itemIdsRef = useRef<string[]>(arrayValue.map((_, i) => String(i)));
  if (itemIdsRef.current.length !== arrayValue.length) {
    // Sync length if external changes happened (e.g., undo)
    while (itemIdsRef.current.length < arrayValue.length) {
      itemIdsRef.current.push(String(nextIdRef.current++));
    }
    if (itemIdsRef.current.length > arrayValue.length) {
      itemIdsRef.current = itemIdsRef.current.slice(0, arrayValue.length);
    }
  }

  // Map from stable ID to current index in arrayValue
  const idToIndexMap = useMemo((): Record<string, number> => {
    const map: Record<string, number> = {};
    for (let i = 0; i < itemIdsRef.current.length; i++) {
      map[itemIdsRef.current[i]] = i;
    }
    return map;
  }, [arrayValue.length]);

  const handleAddItem = useCallback((): void => {
    const newItem = buildDefaultItem(items);
    const newId = String(nextIdRef.current++);
    itemIdsRef.current = [...itemIdsRef.current, newId];
    onChange([...arrayValue, newItem]);
  }, [arrayValue, items, onChange]);

  const handleRemoveItem = useCallback(
    (index: number): void => {
      const nextData = [...arrayValue];
      nextData.splice(index, 1);
      const nextIds = [...itemIdsRef.current];
      nextIds.splice(index, 1);
      itemIdsRef.current = nextIds;
      onChange(nextData);
    },
    [arrayValue, onChange]
  );

  const handleSubFieldChange = useCallback(
    (index: number, fieldKey: string, fieldValue: any): void => {
      const next = arrayValue.map((item, i) => {
        if (i !== index) {
          return item;
        }
        return {...item, [fieldKey]: fieldValue};
      });
      onChange(next);
    },
    [arrayValue, onChange]
  );

  const handleReorder = useCallback(
    (newIds: string[]): void => {
      const reorderedData = newIds.map((id) => {
        const idx = idToIndexMap[id];
        return arrayValue[idx];
      });
      itemIdsRef.current = newIds;
      onChange(reorderedData);
    },
    [arrayValue, idToIndexMap, onChange]
  );

  const subFieldEntries = useMemo((): [string, AdminFieldConfig][] => {
    return Object.entries(items);
  }, [items]);

  const renderItem = useCallback(
    ({item: id}: {item: string}): React.ReactElement => {
      const index = idToIndexMap[id] ?? 0;
      const itemData = arrayValue[index];
      if (!itemData) {
        return <Box />;
      }

      return (
        <Card padding={3}>
          <Box gap={2}>
            <Box alignItems="center" direction="row" justifyContent="between">
              <Text bold size="sm">
                Item {index + 1}
              </Text>
              <IconButton
                accessibilityLabel="Remove item"
                iconName="trash"
                onClick={() => handleRemoveItem(index)}
                tooltipText="Remove"
                variant="destructive"
              />
            </Box>
            {subFieldEntries.map(([fieldKey, fieldConfig]) => (
              <AdminFieldRenderer
                api={api}
                baseUrl={baseUrl}
                fieldConfig={fieldConfig}
                fieldKey={fieldKey}
                key={fieldKey}
                modelConfigs={modelConfigs}
                onChange={(val: any) => handleSubFieldChange(index, fieldKey, val)}
                parentFormState={parentFormState}
                value={itemData[fieldKey]}
              />
            ))}
          </Box>
        </Card>
      );
    },
    [
      arrayValue,
      idToIndexMap,
      subFieldEntries,
      api,
      baseUrl,
      modelConfigs,
      parentFormState,
      handleRemoveItem,
      handleSubFieldChange,
    ]
  );

  const dataIDs = itemIdsRef.current;

  return (
    <Box gap={2}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Heading size="sm">{title}</Heading>
        <Button iconName="plus" onClick={handleAddItem} text="Add" variant="outline" />
      </Box>
      {helperText ? (
        <Text color="secondaryDark" size="sm">
          {helperText}
        </Text>
      ) : null}
      {errorText ? (
        <Text color="error" size="sm">
          {errorText}
        </Text>
      ) : null}

      {arrayValue.length === 0 ? (
        <Box alignItems="center" padding={3}>
          <Text color="secondaryDark">No items. Click &quot;Add&quot; to create one.</Text>
        </Box>
      ) : (
        <DraggableList
          backgroundOnHold="#f0f0f0"
          callbackNewDataIds={handleReorder}
          dataIDs={dataIDs}
          itemHeight={itemHeight}
          itemsGap={ITEMS_GAP}
          renderItem={renderItem}
        />
      )}
    </Box>
  );
};
