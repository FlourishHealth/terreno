import type {Api} from "@reduxjs/toolkit/query/react";
import {
  BooleanField,
  Box,
  Button,
  Heading,
  IconButton,
  SelectField,
  Text,
  TextField,
} from "@terreno/ui";
import startCase from "lodash/startCase";
import React, {useCallback} from "react";
import {AdminRefField} from "./AdminRefField";

interface AdminPrimitiveArrayFieldProps {
  title: string;
  helperText?: string;
  errorText?: string;
  itemType: string;
  itemEnum?: string[];
  itemRef?: string;
  value: PrimitiveItem[];
  onChange: (value: PrimitiveItem[]) => void;
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query Api type is generic; admin code is type-erased here
  api: Api<any, any, any, any>;
  baseUrl: string;
  modelConfigs?: Array<{name: string; routePath: string}>;
}

type PrimitiveItem = string | number | boolean;

const defaultForType = (itemType: string): PrimitiveItem => {
  if (itemType === "boolean") {
    return false;
  }
  if (itemType === "number") {
    return 0;
  }
  return "";
};

/**
 * Renders an editable list of primitive values (string, number, boolean) or ObjectId refs.
 * Used for Mongoose schemas like `tags: [String]`, `scores: [Number]`, `flags: [Boolean]`,
 * or `memberIds: [{type: ObjectId, ref: "User"}]`.
 */
export const AdminPrimitiveArrayField: React.FC<AdminPrimitiveArrayFieldProps> = ({
  title,
  helperText,
  errorText,
  itemType,
  itemEnum,
  itemRef,
  value,
  onChange,
  api,
  baseUrl,
  modelConfigs,
}) => {
  const arrayValue = Array.isArray(value) ? value : [];

  const handleAdd = useCallback(() => {
    onChange([...arrayValue, defaultForType(itemType)]);
  }, [arrayValue, itemType, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(arrayValue.filter((_, i) => i !== index));
    },
    [arrayValue, onChange]
  );

  const handleUpdate = useCallback(
    (index: number, itemValue: PrimitiveItem) => {
      onChange(arrayValue.map((item, i) => (i === index ? itemValue : item)));
    },
    [arrayValue, onChange]
  );

  const refModel =
    itemType === "objectid" && itemRef && modelConfigs
      ? modelConfigs.find((m) => m.name === itemRef)
      : undefined;

  const renderItemInput = (item: PrimitiveItem, index: number): React.ReactElement => {
    if (itemType === "boolean") {
      return (
        <BooleanField
          onChange={(val: boolean) => handleUpdate(index, val)}
          title=""
          value={Boolean(item)}
        />
      );
    }
    if (itemEnum && itemEnum.length > 0) {
      return (
        <SelectField
          onChange={(val: string) => handleUpdate(index, val)}
          options={itemEnum.map((v) => ({label: startCase(v), value: v}))}
          title=""
          value={item != null ? String(item) : ""}
        />
      );
    }
    if (itemType === "objectid" && refModel) {
      return (
        <AdminRefField
          api={api}
          baseUrl={baseUrl}
          onChange={(val: string) => handleUpdate(index, val)}
          refModelName={refModel.name}
          routePath={refModel.routePath}
          title=""
          value={item != null ? String(item) : ""}
        />
      );
    }
    if (itemType === "number") {
      return (
        <TextField
          onChange={(text: string) => {
            const num = Number(text);
            handleUpdate(index, Number.isNaN(num) ? text : num);
          }}
          testID={`admin-array-item-${index}`}
          title=""
          value={item != null ? String(item) : ""}
        />
      );
    }
    // Default: string
    return (
      <TextField
        onChange={(val: string) => handleUpdate(index, val)}
        testID={`admin-array-item-${index}`}
        title=""
        value={item != null ? String(item) : ""}
      />
    );
  };

  return (
    <Box gap={2}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Heading size="sm">{title}</Heading>
        <Button
          iconName="plus"
          onClick={handleAdd}
          testID={`admin-array-add-${title}`}
          text="Add"
          variant="outline"
        />
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
        arrayValue.map((item, index) => (
          <Box alignItems="center" direction="row" gap={2} key={`item-${index}`}>
            <Box flex="grow">{renderItemInput(item, index)}</Box>
            <IconButton
              accessibilityLabel="Remove item"
              iconName="trash"
              onClick={() => handleRemove(index)}
              testID={`admin-array-remove-${index}`}
              variant="destructive"
            />
          </Box>
        ))
      )}
    </Box>
  );
};
