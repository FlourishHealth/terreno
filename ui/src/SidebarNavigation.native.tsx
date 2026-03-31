import {TabRouter} from "@react-navigation/native";
import {Navigator, Slot} from "expo-router";
import {type FC, useCallback, useEffect, useRef, useState} from "react";
import {Animated, Dimensions, Pressable, View} from "react-native";

import type {
  SidebarNavigationItem,
  SidebarNavigationPanelProps,
  SidebarNavigationProps,
} from "./Common";
import {Icon} from "./Icon";
import {Text} from "./Text";
import {useTheme} from "./Theme";

const DRAWER_WIDTH = 280;
const ITEM_HEIGHT = 48;
const ICON_SIZE = 20;
const BACKDROP_OPACITY = 0.5;
const ANIMATION_DURATION = 250;

const SidebarItem: FC<{
  item: SidebarNavigationItem;
  isActive: boolean;
  onPress: (route: string) => void;
}> = ({item, isActive, onPress}) => {
  const {theme} = useTheme();

  const handlePress = useCallback(() => {
    onPress(item.route);
  }, [onPress, item.route]);

  return (
    <Pressable
      accessibilityLabel={item.label}
      accessibilityRole="button"
      onPress={handlePress}
      style={{
        alignItems: "center",
        backgroundColor: isActive ? theme.surface.secondaryLight : "transparent",
        borderRadius: theme.radius.default,
        flexDirection: "row",
        gap: 14,
        height: ITEM_HEIGHT,
        marginHorizontal: 12,
        paddingHorizontal: 14,
      }}
    >
      <View style={{alignItems: "center", justifyContent: "center", width: ICON_SIZE}}>
        <Icon color={isActive ? "primary" : "secondaryDark"} iconName={item.iconName} size="md" />
      </View>
      <Text bold={isActive} color={isActive ? "primary" : "secondaryDark"} size="md">
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
          backgroundColor: theme.surface.primary,
          borderRadius: theme.radius.full,
          elevation: 4,
          height: 44,
          justifyContent: "center",
          left: 16,
          position: "absolute",
          shadowColor: "#000",
          shadowOffset: {height: 2, width: 0},
          shadowOpacity: 0.25,
          shadowRadius: 4,
          top: 16,
          width: 44,
          zIndex: 10,
        }}
      >
        <Icon color="inverted" iconName="bars" size="md" />
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
        style={{
          backgroundColor: theme.surface.base,
          borderColor: theme.border.default,
          borderRightWidth: 1,
          height: screenHeight,
          justifyContent: "space-between",
          left: 0,
          paddingBottom: 32,
          paddingTop: 20,
          position: "absolute",
          top: 0,
          transform: [{translateX: slideAnim}],
          width: DRAWER_WIDTH,
          zIndex: 200,
        }}
      >
        {/* Close button */}
        <View>
          <Pressable
            accessibilityLabel="Close navigation menu"
            accessibilityRole="button"
            onPress={handleClose}
            style={{
              alignItems: "center",
              alignSelf: "flex-end",
              height: 40,
              justifyContent: "center",
              marginRight: 12,
              width: 40,
            }}
          >
            <Icon color="secondaryDark" iconName="xmark" size="md" />
          </Pressable>
          <View style={{gap: 4, marginTop: 8}}>
            {topItems.map((item) => (
              <SidebarItem
                isActive={activeRoute === item.route}
                item={item}
                key={item.route}
                onPress={handleNavigate}
              />
            ))}
          </View>
        </View>

        <View style={{gap: 4}}>
          {bottomItems.map((item) => (
            <SidebarItem
              isActive={activeRoute === item.route}
              item={item}
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
