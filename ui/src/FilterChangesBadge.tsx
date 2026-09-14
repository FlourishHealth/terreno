import type React from "react";

import {Badge} from "./Badge";
import type {FilterChangesBadgeProps} from "./Common";

/**
 * Small blue dot rendered next to a filter control's title when its selection
 * differs from the default. Implemented via the design system `Badge` using the
 * `variant=status, status=active, color=bold` spec.
 */
export const FilterChangesBadge = ({testID}: FilterChangesBadgeProps): React.ReactElement => {
  return <Badge color="bold" status="active" testID={testID} variant="status" />;
};
