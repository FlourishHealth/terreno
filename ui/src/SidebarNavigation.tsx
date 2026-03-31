import {TabRouter} from "@react-navigation/native";
import {Navigator, Slot} from "expo-router";
import {type FC, useCallback, useMemo, useState} from "react";
import {Pressable, View} from "react-native";

import type {
  SidebarNavigationItem,
  SidebarNavigationPanelProps,
  SidebarNavigationProps,
} from "./Common";
import {Icon} from "./Icon";
import {Text} from "./Text";
import {useTheme} from "./Theme";

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 220;
const ITEM_HEIGHT = 44;
const ICON_SIZE = 18;

const SidebarItem: FC<{
  item: SidebarNavigationItem;
  isActive: boolean;
  isExpanded: boolean;
  onNavigate: (route: string) => void;
}> = ({item, isActive, isExpanded, onNavigate}) => {
  const {theme} = useTheme();

  const handlePress = useCallback(() => {
    onNavigate(item.route);
  }, [onNavigate, item.route]);

  // const backgroundColor = useMemo(() => {
  //   if (isActive) {
  //     return theme.surface.secondaryLight;
  //   }
  //   if (isHovered) {
  //     return theme.surface.neutralLight;
  //   }
  //   return "transparent";
  // }, [isActive, isHovered, theme]);

  const iconColor = isActive ? "primary" : "secondaryDark";

  return (
    <Pressable
      accessibilityLabel={item.label}
      accessibilityRole="button"
      onPress={handlePress}
      style={{
        alignItems: "center",
        // backgroundColor,
        borderRadius: theme.radius.default,
        flexDirection: "row",
        gap: 12,
        height: ITEM_HEIGHT,
        marginHorizontal: 8,
        overflow: "hidden",
        paddingHorizontal: 12,
      }}
    >
      <View style={{alignItems: "center", justifyContent: "center", width: ICON_SIZE}}>
        <Icon color={iconColor} iconName={item.iconName} size="sm" />
      </View>
      {isExpanded && (
        <Text bold={isActive} color={isActive ? "primary" : "secondaryDark"} size="md">
          {item.label}
        </Text>
      )}
    </Pressable>
  );
};

/**
 * Renders the sidebar rail + children in a row. Works without expo-router Navigator context.
 */
export const SidebarNavigationPanel: FC<SidebarNavigationPanelProps> = ({
  topItems,
  bottomItems,
  activeRoute,
  onNavigate,
  children,
}) => {
  const {theme} = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleHoverIn = useCallback(() => setIsExpanded(true), []);
  const handleHoverOut = useCallback(() => setIsExpanded(false), []);

  const width = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <View style={{flex: 1, flexDirection: "row"}}>
      <Pressable
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        style={[
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.default,
            borderRightWidth: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
            paddingVertical: 12,
            width,
          },
          // Web-only CSS transitions for smooth expand/collapse
          {
            transitionDuration: "150ms",
            transitionProperty: "width",
            transitionTimingFunction: "ease-in-out",
          } as any,
        ]}
      >
        <View style={{gap: 4}}>
          {topItems.map((item) => (
            <SidebarItem
              isActive={activeRoute === item.route}
              isExpanded={isExpanded}
              item={item}
              key={item.route}
              onNavigate={onNavigate}
            />
          ))}
        </View>
        <View style={{gap: 4}}>
          {bottomItems.map((item) => (
            <SidebarItem
              isActive={activeRoute === item.route}
              isExpanded={isExpanded}
              item={item}
              key={item.route}
              onNavigate={onNavigate}
            />
          ))}
        </View>
      </Pressable>
      <View style={{flex: 1}}>{children}</View>
    </View>
  );
};

/**
 * Reads active route from Navigator context and renders the sidebar + Slot.
 */
const SidebarNavigatorContent: FC<{
  topItems: SidebarNavigationItem[];
  bottomItems: SidebarNavigationItem[];
  onNavigate?: (route: string) => void;
}> = ({topItems, bottomItems, onNavigate}) => {
  const {state, navigation} = Navigator.useContext();
  const activeRoute = state.routes[state.index]?.name;

  const handleNavigate = useCallback(
    (route: string) => {
      navigation.navigate(route);
      onNavigate?.(route);
    },
    [navigation, onNavigate]
  );

  return (
    <SidebarNavigationPanel
      activeRoute={activeRoute}
      bottomItems={bottomItems}
      onNavigate={handleNavigate}
      topItems={topItems}
    >
      <Slot />
    </SidebarNavigationPanel>
  );
};

/**
 * Custom expo-router navigator with a collapsible sidebar rail.
 * Use in _layout.tsx files:
 *
 * ```tsx
 * export default function SidebarLayout() {
 *   return (
 *     <SidebarNavigation
 *       topItems={[{label: "Home", route: "index", iconName: "house"}]}
 *       bottomItems={[{label: "Settings", route: "settings", iconName: "gear"}]}
 *     />
 *   );
 * }
 * ```
 */
export const SidebarNavigation: FC<SidebarNavigationProps> = ({
  topItems,
  bottomItems,
  onNavigate,
  initialRouteName,
  screenOptions,
}) => {
  return (
    <Navigator initialRouteName={initialRouteName} router={TabRouter} screenOptions={screenOptions}>
      <SidebarNavigatorContent
        bottomItems={bottomItems}
        onNavigate={onNavigate}
        topItems={topItems}
      />
    </Navigator>
  );
};
