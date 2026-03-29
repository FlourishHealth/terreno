import {Box, SelectField, Text, TextField} from "@terreno/ui";
import React from "react";

import type {Aggregation, AxisConfig, DataSourceFieldMeta, DateTrunc} from "../types";

const AGGREGATION_OPTIONS: {label: string; value: Aggregation}[] = [
  {label: "Count", value: "count"},
  {label: "Sum", value: "sum"},
  {label: "Average", value: "avg"},
  {label: "Minimum", value: "min"},
  {label: "Maximum", value: "max"},
  {label: "Count Distinct", value: "countDistinct"},
  {label: "Running Total", value: "runningTotal"},
  {label: "Rank", value: "rank"},
];

const DATE_TRUNC_OPTIONS: {label: string; value: DateTrunc}[] = [
  {label: "Year", value: "year"},
  {label: "Quarter", value: "quarter"},
  {label: "Month", value: "month"},
  {label: "Week", value: "week"},
  {label: "Day", value: "day"},
  {label: "Hour", value: "hour"},
];

export interface AxisConfigFormProps {
  label: string;
  value: AxisConfig;
  onChange: (config: AxisConfig) => void;
  fields: Record<string, DataSourceFieldMeta>;
  supportsWindowFields?: boolean;
  showAggregation?: boolean;
  testID?: string;
}

export const AxisConfigForm: React.FC<AxisConfigFormProps> = ({
  fields,
  label,
  onChange,
  showAggregation = true,
  supportsWindowFields = false,
  testID,
  value,
}) => {
  const fieldOptions = Object.entries(fields).map(([name, field]) => ({
    label: `${name} (${field.type})`,
    value: name,
  }));

  const selectedField = value.field ? fields[value.field] : undefined;
  const isDateField = selectedField?.type === "date";

  const aggregationOptions = supportsWindowFields
    ? AGGREGATION_OPTIONS
    : AGGREGATION_OPTIONS.filter((o) => o.value !== "runningTotal" && o.value !== "rank");

  return (
    <Box gap={2} testID={testID ?? `axis-config-${label.toLowerCase()}`}>
      <Text bold size="sm">
        {label} Axis
      </Text>

      <SelectField
        onChange={(field) => onChange({...value, dateTrunc: undefined, field})}
        options={fieldOptions}
        requireValue
        title="Field"
        value={value.field}
      />

      <TextField
        onChange={(lbl) => onChange({...value, label: lbl || undefined})}
        placeholder="Optional label"
        testID={`${testID ?? "axis"}-label-input`}
        title="Label"
        value={value.label ?? ""}
      />

      {showAggregation && (
        <SelectField
          onChange={(agg) => onChange({...value, aggregation: (agg as Aggregation) || undefined})}
          options={[{label: "None", value: ""}, ...aggregationOptions]}
          title="Aggregation"
          value={value.aggregation ?? ""}
        />
      )}

      {isDateField && (
        <SelectField
          onChange={(trunc) => onChange({...value, dateTrunc: (trunc as DateTrunc) || undefined})}
          options={[{label: "None (raw)", value: ""}, ...DATE_TRUNC_OPTIONS]}
          title="Date Granularity"
          value={value.dateTrunc ?? ""}
        />
      )}
    </Box>
  );
};
