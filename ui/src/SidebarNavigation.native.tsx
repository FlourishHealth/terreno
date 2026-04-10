import {TabRouter} from "@react-navigation/native";
import {Navigator, Slot} from "expo-router";
import {type FC, useCallback, useEffect, useRef, useState} from "react";
import {Animated, Dimensions, Pressable, type StyleProp, View, type ViewStyle} from "react-native";

import {Badge} from "./Badge";
import type {
  SidebarNavigationItem,
  SidebarNavigationPanelProps,
  SidebarNavigationProps,
} from "./Common";
import {SIDEBAR_BADGE_STATUS_MAP} from "./Common";
import {Icon} from "./Icon";
import {Text} from "./Text";
import {useTheme} from "./Theme";

const DRAWER_WIDTH = 280;
const ITEM_HEIGHT = 44;
const ICON_SIZE = 20;
const BACKDROP_OPACITY = 0.5;
const ANIMATION_DURATION = 250;

const SidebarItem: FC<{
  item: SidebarNavigationItem;
  isActive: boolean;
  onPress: (route: string) => void;
  itemStyle?: StyleProp<ViewStyle>;
}> = ({item, isActive, onPress, itemStyle}) => {
  const {theme} = useTheme();

  const handlePress = useCallback(() => {
    onPress(item.route);
  }, [onPress, item.route]);

  return (
    <Pressable
      accessibilityLabel={item.label}
      accessibilityRole="button"
      onPress={handlePress}
      style={[
        {
          alignItems: "center",
          backgroundColor: isActive ? theme.surface.neutralLight : "transparent",
          borderRadius: theme.radius.default,
          flexDirection: "row",
          gap: 12,
          height: ITEM_HEIGHT,
          marginHorizontal: 8,
          paddingHorizontal: 12,
        },
        itemStyle,
      ]}
    >
      <View style={{alignItems: "center", justifyContent: "center", width: ICON_SIZE}}>
        <Icon color={isActive ? "primary" : "secondaryLight"} iconName={item.iconName} size="lg" />
        {Boolean(item.badge) && (
          <View
            style={{
              bottom: item.badge === true ? -4 : undefined,
              position: "absolute",
              right: -6,
              top: item.badge === true ? undefined : -4,
            }}
          >
            <Badge
              maxValue={99}
              status={SIDEBAR_BADGE_STATUS_MAP[item.badgeStatus ?? "error"]}
              value={item.badge === true ? undefined : String(item.badge)}
              variant={item.badge === true ? "iconOnly" : "numberOnly"}
            />
          </View>
        )}
      </View>
      <Text bold={isActive} color={isActive ? "primary" : "secondaryLight"} size="md">
        {item.label}
      </Text>
    </Pressable>
  );
};

/**
 * Renders the hamburger button, drawer overlay, and children. Works without expo-router Navigator context.
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
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Animate drawer open/close
  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          duration: ANIMATION_DURATION,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          duration: ANIMATION_DURATION,
          toValue: BACKDROP_OPACITY,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          duration: ANIMATION_DURATION,
          toValue: -DRAWER_WIDTH,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          duration: ANIMATION_DURATION,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, backdropAnim]);

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleNavigate = useCallback(
    (route: string) => {
      setIsOpen(false);
      onNavigate(route);
    },
    [onNavigate]
  );

  const screenHeight = Dimensions.get("window").height;

  return (
    <View style={{flex: 1}}>
      {children}

      {/* Hamburger button */}
      <Pressable
        accessibilityLabel="Open navigation menu"
        accessibilityRole="button"
        onPress={handleOpen}
        style={{
          alignItems: "center",
          height: 44,
          justifyContent: "center",
          left: 16,
          position: "absolute",
          top: 16,
          width: 44,
          zIndex: 10,
        }}
      >
        <Icon color="primary" iconName="bars" size="md" />
      </Pressable>

      {/* Backdrop */}
      {isOpen && (
        <Pressable
          onPress={handleClose}
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 100,
          }}
        >
          <Animated.View
            style={{
              backgroundColor: "#000",
              flex: 1,
              opacity: backdropAnim,
            }}
          />
        </Pressable>
      )}

      {/* Drawer */}
      <Animated.View
        style={[
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.default,
            borderRightWidth: 1,
            height: screenHeight,
            left: 0,
            paddingBottom: 32,
            paddingTop: 20,
            position: "absolute",
            top: 0,
            transform: [{translateX: slideAnim}],
            width: DRAWER_WIDTH,
            zIndex: 200,
          },
          panelStyle,
        ]}
      >
        <View style={{gap: 4}}>
          {[...topItems, ...bottomItems].map((item) => (
            <SidebarItem
              isActive={activeRoute === item.route}
              item={item}
              itemStyle={itemStyle}
              key={item.route}
              onPress={handleNavigate}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

/**
 * Reads active route from Navigator context and renders the drawer + Slot.
 */
const SidebarNavigatorContent: FC<{
  topItems: SidebarNavigationItem[];
  bottomItems: SidebarNavigationItem[];
  onNavigate?: (route: string) => void;
  panelStyle?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
}> = ({topItems, bottomItems, onNavigate, panelStyle, itemStyle}) => {
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
      itemStyle={itemStyle}
      onNavigate={handleNavigate}
      panelStyle={panelStyle}
      topItems={topItems}
    >
      <Slot />
    </SidebarNavigationPanel>
  );
};

/**
 * Custom expo-router navigator with a hamburger-triggered slide-in drawer.
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
  panelStyle,
  itemStyle,
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
    </Navigator>
  );
};
