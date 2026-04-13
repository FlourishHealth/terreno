import type React from "react";

import {Box} from "./Box";
import type {RadioProps} from "./Common";
import {useTheme} from "./Theme";

export const Radio: React.FC<RadioProps> = ({selected}) => {
  const {theme} = useTheme();

  return (
    <Box
      alignItems="center"
      dangerouslySetInlineStyle={{
        __style: {
          borderColor: theme.text.secondaryDark,
          borderWidth: 1,
        },
      }}
      height={16}
      justifyContent="center"
      rounding="circle"
      width={16}
    >
      {selected ? (
        <Box
          dangerouslySetInlineStyle={{
            __style: {
              backgroundColor: theme.text.secondaryDark,
            },
          }}
          height={10}
          rounding="circle"
          width={10}
        />
      ) : null}
    </Box>
  );
};
