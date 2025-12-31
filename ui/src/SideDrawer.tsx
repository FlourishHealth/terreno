import {type ReactElement, useCallback} from "react";
import {Platform, SafeAreaView, type StyleProp, type ViewStyle} from "react-native";
import {Drawer} from "react-native-drawer-layout";

import type {SideDrawerProps} from "./Common";
import {useTheme} from "./Theme";

const DEFAULT_STYLES: StyleProp<ViewStyle> = {
  borderColor: "gray",
  borderWidth: 1,
  height: "100%",
  width: Platform.OS === "web" ? "40%" : "95%",
};

const addWebScroll = (isOpen: boolean): ViewStyle => {
  if (Platform.OS === "web") {
    return {display: isOpen ? "flex" : "none", overflow: "scroll"};
  } else {
    return {};
  }
};

export const SideDrawer = ({
  position = "left",
  isOpen,
  renderContent,
  onClose = () => {},
  onOpen = () => {},
  drawerType = "front",
  children,
  drawerStyles = {},
}: SideDrawerProps): ReactElement => {
  const {theme} = useTheme();
  const renderDrawerContent = useCallback((): ReactElement => {
    return <SafeAreaView>{renderContent()}</SafeAreaView>;
  }, [renderContent]);

  return (
    <Drawer
      drawerPosition={position}
      drawerStyle={[
        DEFAULT_STYLES,
        {backgroundColor: theme.surface.neutralLight},
        drawerStyles,
        addWebScroll(isOpen),
      ]}
      drawerType={drawerType}
      onClose={onClose}
      onOpen={onOpen}
      open={isOpen}
      renderDrawerContent={renderDrawerContent}
    >
      {children}
    </Drawer>
  );
};
