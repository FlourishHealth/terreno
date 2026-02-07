import {Box} from "./Box";
import type {BoxProps} from "./Common";

export const Card = ({children, color = "base", padding = 4, ...rest}: BoxProps) => {
  return (
    <Box
      color={color}
      direction="column"
      display="flex"
      padding={padding}
      rounding="md"
      shadow
      {...rest}
    >
      {children}
    </Box>
  );
};
