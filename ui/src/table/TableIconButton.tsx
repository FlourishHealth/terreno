/* eslint-disable react-native-a11y/has-accessibility-hint */
// accessibility hint handled in IconButton.tsx

import type {FC} from "react";
import {View} from "react-native";

import type {IconButtonProps, IconName, TableIconButtonProps} from "../Common";
import {IconButton} from "../IconButton";

export const TableIconButton: FC<TableIconButtonProps> = ({tableIconButtonName, onClick}) => {
  const iconButtonMap: Record<
    string,
    {
      iconName: IconName;
      variant: IconButtonProps["variant"];
      accessibilityLabel: string;
      accessibilityHint: string;
    }
  > = {
    drawerClose: {
      accessibilityHint: "Close Drawer",
      accessibilityLabel: "Close Drawer for more Data",
      iconName: "chevron-up",
      variant: "secondary",
    },
    drawerOpen: {
      accessibilityHint: "Open Drawer",
      accessibilityLabel: "Open Drawer for more Data",
      iconName: "chevron-down",
      variant: "muted",
    },
    edit: {
      accessibilityHint: "Edit row",
      accessibilityLabel: "Edit",
      iconName: "pen-to-square",
      variant: "muted",
    },
    insert: {
      accessibilityHint: "Insert Data",
      accessibilityLabel: "Insert Data",
      iconName: "plus",
      variant: "primary",
    },
    saveAndClose: {
      accessibilityHint: "Save and close row",
      accessibilityLabel: "Save and close",
      iconName: "check",
      variant: "secondary",
    },
  };

  return (
    <View style={{alignItems: "center", justifyContent: "center", width: "100%"}}>
      <IconButton
        accessibilityLabel={iconButtonMap[tableIconButtonName].accessibilityLabel}
        iconName={iconButtonMap[tableIconButtonName].iconName}
        onClick={onClick}
        variant={iconButtonMap[tableIconButtonName].variant}
      />
    </View>
  );
};
