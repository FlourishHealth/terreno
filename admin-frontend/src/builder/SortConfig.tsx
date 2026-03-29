import {Box, SelectField, Text} from "@terreno/ui";
import React from "react";

import type {DataSourceFieldMeta} from "../types";

export interface SortConfigValue {
  field: string;
  direction: "asc" | "desc";
}

export interface SortConfigProps {
  value?: SortConfigValue;
  onChange: (sort: SortConfigValue | undefined) => void;
  fields: Record<string, DataSourceFieldMeta>;
  testID?: string;
}

export const SortConfig: React.FC<SortConfigProps> = ({fields, onChange, testID, value}) => {
  const fieldOptions = [
    {label: "None (default)", value: ""},
    ...Object.keys(fields).map((name) => ({label: name, value: name})),
  ];

  const directionOptions = [
    {label: "Ascending", value: "asc"},
    {label: "Descending", value: "desc"},
  ];

  return (
    <Box gap={2} testID={testID ?? "sort-config"}>
      <Text bold size="sm">
        Sort
      </Text>

      <Box direction="row" gap={2}>
        <Box flex="grow">
          <SelectField
            onChange={(field) => {
              if (!field) {
                onChange(undefined);
              } else {
                onChange({direction: value?.direction ?? "asc", field});
              }
            }}
            options={fieldOptions}
            title="Sort Field"
            value={value?.field ?? ""}
          />
        </Box>

        {value?.field && (
          <Box flex="grow">
            <SelectField
              onChange={(dir) => onChange({direction: dir as "asc" | "desc", field: value.field})}
              options={directionOptions}
              requireValue
              title="Direction"
              value={value.direction}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
