import {Box, Text} from "@terreno/ui";
import React from "react";

interface MissingWidgetProps {
  bucket: "fields" | "home" | "screens";
  widgetId: string;
}

export const MissingWidget: React.FC<MissingWidgetProps> = ({bucket, widgetId}) => {
  return (
    <Box border="default" padding={3} rounding="md" testID={`admin-missing-widget-${widgetId}`}>
      <Text color="secondaryDark" size="sm">
        {`Unknown admin ${bucket} widget "${widgetId}". Register it on AdminProvider.widgets.${bucket}.`}
      </Text>
    </Box>
  );
};
