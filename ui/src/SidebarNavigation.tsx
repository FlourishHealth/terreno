import {TabRouter} from "@react-navigation/native";
import {Navigator, Slot} from "expo-router";
// Screen is the same component used internally by Stack.Screen and Tabs.Screen
// eslint-disable-next-line import/no-internal-modules
import {Screen} from "expo-router/build/views/Screen";
import {type FC, useCallback, useMemo, useState} from "react";
import {Pressable, type StyleProp, View, type ViewStyle} from "react-native";

import {Badge} from "./Badge";
import {Box} from "./Box";
import type {
  SidebarNavigationItem,
  SidebarNavigationPanelProps,
  SidebarNavigationProps,
} from "./Common";
import {SIDEBAR_BADGE_STATUS_MAP} from "./Common";
import {Icon} from "./Icon";
import {Text} from "./Text";
import {useTheme} from "./Theme";

const COLLAPSED_WIDTH = 65;
const EXPANDED_WIDTH = 220;
const ITEM_HEIGHT = 44;
const ICON_SIZE = 18;

const SidebarItem: FC<{
  item: SidebarNavigationItem;
  isActive: boolean;
  isExpanded: boolean;
  onNavigate: (route: string) => void;
  itemStyle?: StyleProp<ViewStyle>;
}> = ({item, isActive, isExpanded, onNavigate, itemStyle}) => {
  const {theme} = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const handlePress = useCallback(() => {
    onNavigate(item.route);
  }, [onNavigate, item.route]);

  const handleHoverIn = useCallback(() => setIsHovered(true), []);
  const handleHoverOut = useCallback(() => setIsHovered(false), []);

  const backgroundColor = useMemo(() => {
    if (isActive) {
      return theme.surface.secondaryLight;
    }
    if (isHovered) {
      return theme.surface.neutralLight;
    }
    return "transparent";
  }, [isActive, isHovered, theme]);

  const iconColor = isActive ? "primary" : "secondaryDark";

  return (
    <Pressable
      accessibilityLabel={item.label}
      accessibilityRole="button"
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={handlePress}
      style={[
        {
          alignItems: "center",
          backgroundColor,
          borderRadius: theme.radius.default,
          flexDirection: "row",
          gap: 12,
          height: ITEM_HEIGHT,
          justifyContent: isExpanded ? undefined : "center",
          marginHorizontal: 8,
          paddingHorizontal: 12,
        },
        itemStyle,
      ]}
    >
      <View style={{alignItems: "center", justifyContent: "center", width: ICON_SIZE}}>
        <Icon color={iconColor} iconName={item.iconName} size="lg" />
        {Boolean(item.badge) && (
          <Box marginLeft={5} marginTop={5} position="absolute">
            <Badge
              maxValue={99}
              status={SIDEBAR_BADGE_STATUS_MAP[item.badgeStatus ?? "error"]}
              value={item.badge === true ? undefined : String(item.badge)}
              variant={item.badge === true ? "iconOnly" : "numberOnly"}
            />
          </Box>
        )}
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
  panelStyle,
  itemStyle,
}) => {
  const {theme} = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleHoverIn = useCallback(() => {
    setIsExpanded(true);
  }, []);
  const handleHoverOut = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const width = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <View style={{flex: 1}}>
      <View style={{flex: 1, marginLeft: COLLAPSED_WIDTH}}>{children}</View>
      <View
        {...({onMouseEnter: handleHoverIn, onMouseLeave: handleHoverOut} as any)}
        style={[
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.default,
            borderRightWidth: 1,
            bottom: 0,
            flexDirection: "column",
            justifyContent: "space-between",
            left: 0,
            overflow: "hidden",
            paddingVertical: 12,
            position: "absolute",
            top: 0,
            width,
            zIndex: 10,
          },
          // Web-only CSS transitions for smooth expand/collapse
          {
            transitionDuration: "150ms",
            transitionProperty: "width",
            transitionTimingFunction: "ease-in-out",
          } as any,
          panelStyle,
        ]}
      >
        <View style={{gap: 4}}>
          {topItems.map((item) => (
            <SidebarItem
              isActive={activeRoute === item.route}
              isExpanded={isExpanded}
              item={item}
              itemStyle={itemStyle}
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
              itemStyle={itemStyle}
              key={item.route}
              onNavigate={onNavigate}
            />
          ))}
        </View>
      </View>
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
  panelStyle?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
}> = ({topItems, bottomItems, onNavigate, panelStyle, itemStyle}) => {
  const {theme} = useTheme();
  const {state, navigation, descriptors} = Navigator.useContext();
  const activeRoute = state.routes[state.index];
  const {headerLeft, headerRight, title} = (descriptors[activeRoute?.key]?.options ?? {}) as any;

  const handleNavigate = useCallback(
    (route: string) => {
      navigation.navigate(route);
      onNavigate?.(route);
    },
    [navigation, onNavigate]
  );

  return (
    <View style={{flex: 1}}>
      {(title || headerLeft || headerRight) && (
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.surface.base,
            borderBottomColor: theme.border.default,
            borderBottomWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 52,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <View style={{minWidth: 40}}>{headerLeft?.()}</View>
          <Text bold size="lg">
            {title}
          </Text>
          <View style={{alignItems: "flex-end", minWidth: 40}}>{headerRight?.()}</View>
        </View>
      )}
      <SidebarNavigationPanel
        activeRoute={activeRoute?.name}
        bottomItems={bottomItems}
        itemStyle={itemStyle}
        onNavigate={handleNavigate}
        panelStyle={panelStyle}
        topItems={topItems}
      >
        <Slot />
      </SidebarNavigationPanel>
    </View>
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
const SidebarNavigationBase: FC<SidebarNavigationProps> = ({
  topItems,
  bottomItems,
  onNavigate,
  initialRouteName,
  screenOptions,
  panelStyle,
  itemStyle,
  children,
}) => {
  return (
    <Navigator initialRouteName={initialRouteName} router={TabRouter} screenOptions={screenOptions}>
      <SidebarNavigatorContent
        bottomItems={bottomItems}
        itemStyle={itemStyle}
        onNavigate={onNavigate}
        panelStyle={panelStyle}
        topItems={topItems}
      />
      {children}
    </Navigator>
  );
};

/**
 * Custom expo-router navigator with a collapsible sidebar rail.
 * Supports per-screen options via SidebarNavigation.Screen, matching the
 * Stack.Screen / Tabs.Screen pattern.
 */
export const SidebarNavigation = Object.assign(SidebarNavigationBase, {Screen});
