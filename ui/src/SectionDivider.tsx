import type React from "react";

import {Box} from "./Box";
import {useTheme} from "./Theme";

export const SectionDivider: React.FC<{}> = () => {
  const {theme} = useTheme();
  return (
    <Box
      aria-hidden={true}
      height={1}
      style={{backgroundColor: theme.primitives.neutral500}}
      width="100%"
    />
  );
};
