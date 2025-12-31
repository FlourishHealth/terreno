import type React from "react";

import type {InfoTooltipButtonProps} from "./Common";
import {IconButton} from "./IconButton";

export const InfoTooltipButton = ({text}: InfoTooltipButtonProps): React.ReactElement => {
  return (
    <IconButton
      accessibilityHint="Show info tooltip"
      accessibilityLabel="info"
      iconName="exclamation"
      onClick={() => {}}
      tooltipText={text}
    />
  );
};
