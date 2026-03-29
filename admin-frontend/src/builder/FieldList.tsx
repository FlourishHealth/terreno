import {Badge, Box, Text} from "@terreno/ui";
import React from "react";

import type {DataSourceFieldMeta} from "../types";

export interface FieldListProps {
  fields: Record<string, DataSourceFieldMeta>;
  onFieldClick?: (fieldName: string, field: DataSourceFieldMeta) => void;
  testID?: string;
}

const DIMENSION_COLOR = "#3b82f6";
const MEASURE_COLOR = "#22c55e";

export const FieldList: React.FC<FieldListProps> = ({fields, onFieldClick, testID}) => {
  const fieldEntries = Object.entries(fields);

  if (fieldEntries.length === 0) {
    return (
      <Box padding={4} testID={testID}>
        <Text color="secondaryDark">No fields available.</Text>
      </Box>
    );
  }

  const dimensions = fieldEntries.filter(([, f]) => f.role === "dimension");
  const measures = fieldEntries.filter(([, f]) => f.role === "measure");

  // Dimension color (blue) and measure color (green) — inline for label headers
  const dimensionHeaderStyle = {color: DIMENSION_COLOR};
  const measureHeaderStyle = {color: MEASURE_COLOR};

  const renderField = ([name, field]: [string, DataSourceFieldMeta]) => {
    const boxProps = onFieldClick
      ? {
          accessibilityHint: `Select ${name} field`,
          accessibilityLabel: name,
          onClick: () => onFieldClick(name, field),
        }
      : {};

    return (
      <Box
        {...boxProps}
        border="default"
        direction="row"
        gap={2}
        key={name}
        marginBottom={2}
        padding={2}
        rounding="sm"
        testID={`field-list-item-${name}`}
      >
        <Box flex="grow">
          <Text bold size="sm">
            {name}
          </Text>
          {field.description ? (
            <Text color="secondaryDark" size="sm">
              {field.description}
            </Text>
          ) : null}
        </Box>
        <Box alignItems="center" direction="row" gap={1}>
          <Badge status="neutral" value={field.type} />
          <Badge status="info" value={field.role} />
        </Box>
      </Box>
    );
  };

  return (
    <Box testID={testID ?? "field-list"}>
      {dimensions.length > 0 && (
        <Box marginBottom={3}>
          <Box marginBottom={2} style={dimensionHeaderStyle}>
            <Text bold color="primary" size="sm">
              Dimensions
            </Text>
          </Box>
          {dimensions.map(renderField)}
        </Box>
      )}
      {measures.length > 0 && (
        <Box>
          <Box marginBottom={2} style={measureHeaderStyle}>
            <Text bold color="primary" size="sm">
              Measures
            </Text>
          </Box>
          {measures.map(renderField)}
        </Box>
      )}
    </Box>
  );
};
