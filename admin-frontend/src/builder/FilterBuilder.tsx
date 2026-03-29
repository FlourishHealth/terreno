import {Box, Button, SelectField, Text, TextField} from "@terreno/ui";
import React from "react";

import type {DataSourceFieldMeta, DateTrunc, FilterConfig} from "../types";

const COMPARISON_FILTER_TYPES = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;
const SET_FILTER_TYPES = ["in", "nin"] as const;

const FILTER_TYPE_OPTIONS = [
  {label: "Equals", value: "eq"},
  {label: "Not equals", value: "ne"},
  {label: "Greater than", value: "gt"},
  {label: "Greater than or equal", value: "gte"},
  {label: "Less than", value: "lt"},
  {label: "Less than or equal", value: "lte"},
  {label: "In list", value: "in"},
  {label: "Not in list", value: "nin"},
  {label: "Date range", value: "dateRange"},
  {label: "Relative date", value: "relative"},
];

const DATE_TRUNC_OPTIONS: {label: string; value: DateTrunc}[] = [
  {label: "Hours", value: "hour"},
  {label: "Days", value: "day"},
  {label: "Weeks", value: "week"},
  {label: "Months", value: "month"},
  {label: "Quarters", value: "quarter"},
  {label: "Years", value: "year"},
];

const defaultFilter = (): FilterConfig => ({
  field: "",
  type: "eq",
  value: "",
});

export interface FilterBuilderProps {
  filters: FilterConfig[];
  onChange: (filters: FilterConfig[]) => void;
  fields: Record<string, DataSourceFieldMeta>;
  testID?: string;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  fields,
  filters,
  onChange,
  testID,
}) => {
  const fieldOptions = Object.keys(fields).map((name) => ({label: name, value: name}));

  const addFilter = () => {
    onChange([...filters, defaultFilter()]);
  };

  const removeFilter = (index: number) => {
    const updated = filters.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateFilter = (index: number, updated: FilterConfig) => {
    const next = [...filters];
    next[index] = updated;
    onChange(next);
  };

  const renderFilterRow = (filter: FilterConfig, index: number) => {
    const isComparison = COMPARISON_FILTER_TYPES.includes(filter.type as any);
    const isSet = SET_FILTER_TYPES.includes(filter.type as any);
    const isDateRange = filter.type === "dateRange";
    const isRelative = filter.type === "relative";

    const baseUpdate = (partial: Partial<FilterConfig>) =>
      updateFilter(index, {...filter, ...partial} as FilterConfig);

    return (
      <Box
        border="default"
        gap={2}
        key={index}
        marginBottom={2}
        padding={3}
        rounding="md"
        testID={`filter-row-${index}`}
      >
        <Box alignItems="center" direction="row" gap={2}>
          <Box flex="grow">
            <SelectField
              onChange={(field) => baseUpdate({field})}
              options={fieldOptions}
              title="Field"
              value={filter.field}
            />
          </Box>
          <Box>
            <SelectField
              onChange={(type) => {
                // Reset value when switching filter type
                if (type === "in" || type === "nin") {
                  updateFilter(index, {
                    field: filter.field,
                    type: type as "in" | "nin",
                    values: [],
                  });
                } else if (type === "dateRange") {
                  updateFilter(index, {field: filter.field, type: "dateRange"});
                } else if (type === "relative") {
                  updateFilter(index, {
                    amount: 30,
                    field: filter.field,
                    type: "relative",
                    unit: "day",
                  });
                } else {
                  updateFilter(index, {field: filter.field, type: type as any, value: ""});
                }
              }}
              options={FILTER_TYPE_OPTIONS}
              title="Type"
              value={filter.type}
            />
          </Box>
          <Button
            iconName="trash"
            onClick={() => removeFilter(index)}
            testID={`filter-${index}-remove`}
            text=""
            variant="destructive"
          />
        </Box>

        {isComparison && (
          <TextField
            onChange={(val) => baseUpdate({value: val})}
            placeholder="Filter value"
            testID={`filter-${index}-value`}
            title="Value"
            value={String((filter as any).value ?? "")}
          />
        )}

        {isSet && (
          <TextField
            helperText="Comma-separated values"
            onChange={(val) => {
              const values = val
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              baseUpdate({values});
            }}
            placeholder="value1, value2, value3"
            testID={`filter-${index}-values`}
            title="Values"
            value={((filter as any).values ?? []).join(", ")}
          />
        )}

        {isDateRange && (
          <Box direction="row" gap={2}>
            <Box flex="grow">
              <TextField
                onChange={(from) => baseUpdate({from: from || undefined})}
                placeholder="YYYY-MM-DD"
                testID={`filter-${index}-from`}
                title="From"
                value={(filter as any).from ?? ""}
              />
            </Box>
            <Box flex="grow">
              <TextField
                onChange={(to) => baseUpdate({to: to || undefined})}
                placeholder="YYYY-MM-DD"
                testID={`filter-${index}-to`}
                title="To"
                value={(filter as any).to ?? ""}
              />
            </Box>
          </Box>
        )}

        {isRelative && (
          <Box direction="row" gap={2}>
            <Box flex="grow">
              <TextField
                onChange={(val) => baseUpdate({amount: Number.parseInt(val, 10) || 30})}
                placeholder="30"
                testID={`filter-${index}-amount`}
                title="Amount"
                value={String((filter as any).amount ?? 30)}
              />
            </Box>
            <Box flex="grow">
              <SelectField
                onChange={(unit) => baseUpdate({unit: unit as DateTrunc})}
                options={DATE_TRUNC_OPTIONS}
                title="Unit"
                value={(filter as any).unit ?? "day"}
              />
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box testID={testID ?? "filter-builder"}>
      <Box alignItems="center" direction="row" justifyContent="between" marginBottom={2}>
        <Text bold size="sm">
          Filters
        </Text>
        <Button
          iconName="plus"
          onClick={addFilter}
          testID="filter-add-button"
          text="Add Filter"
          variant="secondary"
        />
      </Box>

      {filters.length === 0 ? (
        <Text color="secondaryDark" size="sm">
          No filters applied
        </Text>
      ) : (
        filters.map(renderFilterRow)
      )}
    </Box>
  );
};
