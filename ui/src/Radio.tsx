import type React from "react";
import {View} from "react-native";

import type {RadioProps} from "./Common";
import {useTheme} from "./Theme";

export const Radio = ({selected}: RadioProps): React.ReactElement => {
  const {theme} = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        borderColor: theme.text.secondaryDark,
        borderRadius: 12,
        borderWidth: 1,
        height: 16,
        justifyContent: "center",
        width: 16,
      }}
    >
      {selected ? (
        <View
          style={{
            backgroundColor: theme.text.secondaryDark,
            borderRadius: 6,
            height: 10,
            width: 10,
          }}
        />
      ) : null}
    </View>
  );
};
