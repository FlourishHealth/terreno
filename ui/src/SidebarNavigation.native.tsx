import {TabRouter} from "@react-navigation/native";
import {Navigator, Slot} from "expo-router";
import {type FC, useCallback, useEffect, useRef, useState} from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";

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

const SidebarHamburger: FC<{onOpen: () => void}> = ({onOpen}) => (
  <Pressable
    accessibilityLabel="Open navigation menu"
    accessibilityRole="button"
    onPress={onOpen}
    style={{alignItems: "center", height: 40, justifyContent: "center", width: 40}}
  >
    <Icon color="primary" iconName="bars" size="md" />
  </Pressable>
);

/**
 * Renders the drawer overlay and children. Works without expo-router Navigator context.
 *
 * Supports two modes:
 * - Uncontrolled (default): manages open state internally and shows a floating hamburger button.
 * - Controlled: caller provides isOpen + onOpenChange and owns the trigger (e.g. a header button).
 */
export const SidebarNavigationPanel: FC<SidebarNavigationPanelProps> = ({
  topItems,
  bottomItems,
  activeRoute,
  onNavigate,
  children,
  panelStyle,
  itemStyle,
  isOpen: isOpenProp,
  onOpenChange,
}) => {
  const {theme} = useTheme();
  const isControlled = isOpenProp !== undefined;
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isControlled ? isOpenProp : isOpenInternal;

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

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

  const handleOpen = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(true);
    } else {
      setIsOpenInternal(true);
    }
  }, [isControlled, onOpenChange]);

  const handleClose = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setIsOpenInternal(false);
    }
  }, [isControlled, onOpenChange]);

  const handleNavigate = useCallback(
    (route: string) => {
      handleClose();
      onNavigate(route);
    },
    [handleClose, onNavigate]
  );

  const screenHeight = Dimensions.get("window").height;

  return (
    <View style={{flex: 1}}>
      {children}

      {/* Floating hamburger — only shown in uncontrolled (standalone) mode */}
      {!isControlled && (
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
      )}

      {/* Backdrop */}
      {isOpen && (
        <Pressable
          accessibilityElementsHidden
          onPress={handleClose}
          style={{bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 100}}
        >
          <Animated.View style={{backgroundColor: "#000", flex: 1, opacity: backdropAnim}} />
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
 * Reads active route and screen options from Navigator context.
 * Renders a native header bar (with safe area, hamburger, title, headerLeft/headerRight)
 * and passes controlled open state down to SidebarNavigationPanel.
 */
const SidebarNavigatorContent: FC<{
  topItems: SidebarNavigationItem[];
  bottomItems: SidebarNavigationItem[];
  onNavigate?: (route: string) => void;
  panelStyle?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
}> = ({topItems, bottomItems, onNavigate, panelStyle, itemStyle}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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
      {/* Header bar */}
      <View
        style={{
          backgroundColor: theme.surface.base,
          borderBottomColor: theme.border.default,
          borderBottomWidth: 1,
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 52,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <View style={{alignItems: "center", flexDirection: "row", gap: 12}}>
            <SidebarHamburger onOpen={() => setIsSheetOpen(true)} />
            {headerLeft?.({})}
            {Boolean(title) && (
              <Text bold size="lg">
                {title}
              </Text>
            )}
          </View>
          {Boolean(headerRight) && (
            <View style={{alignItems: "flex-end"}}>{headerRight?.({})}</View>
          )}
        </View>
      </View>

      {/* Content + drawer */}
      <SidebarNavigationPanel
        activeRoute={activeRoute?.name}
        bottomItems={bottomItems}
        isOpen={isSheetOpen}
        itemStyle={itemStyle}
        onNavigate={handleNavigate}
        onOpenChange={setIsSheetOpen}
        panelStyle={panelStyle}
        topItems={topItems}
      >
        <Slot />
      </SidebarNavigationPanel>
    </View>
  );
};

/**
 * Custom expo-router navigator with a header bar and hamburger-triggered slide-in drawer.
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
    <View style={StyleSheet.absoluteFillObject}>
      <Navigator
        initialRouteName={initialRouteName}
        router={TabRouter}
        screenOptions={screenOptions}
      >
        <SidebarNavigatorContent
          bottomItems={bottomItems}
          itemStyle={itemStyle}
          onNavigate={onNavigate}
          panelStyle={panelStyle}
          topItems={topItems}
        />
      </Navigator>
    </View>
  );
};
