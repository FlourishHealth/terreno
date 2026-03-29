import {Box, SelectField, Spinner, Text} from "@terreno/ui";
import React from "react";

import type {DataSourceMeta} from "../types";

export interface DataSourcePickerProps {
  sources: DataSourceMeta[];
  isLoading?: boolean;
  value: string;
  onChange: (sourceName: string) => void;
  testID?: string;
}

export const DataSourcePicker: React.FC<DataSourcePickerProps> = ({
  isLoading,
  onChange,
  sources,
  testID,
  value,
}) => {
  if (isLoading) {
    return (
      <Box alignItems="center" padding={4} testID={testID}>
        <Spinner />
      </Box>
    );
  }

  if (sources.length === 0) {
    return (
      <Box padding={4} testID={testID}>
        <Text color="secondaryDark">No data sources registered.</Text>
      </Box>
    );
  }

  const options = sources.map((s) => ({label: s.displayName, value: s.name}));

  return (
    <Box testID={testID ?? "data-source-picker"}>
      <SelectField
        onChange={onChange}
        options={options}
        requireValue
        title="Data Source"
        value={value}
      />
    </Box>
  );
};
