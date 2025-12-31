/* eslint-disable react/prop-types */
import React, {useImperativeHandle} from "react";
import {
  type AccessibilityProps,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  View,
} from "react-native";

import {getRounding, getSpacing, useTheme} from ".";
import type {
  AlignContent,
  AlignItems,
  AlignSelf,
  BorderTheme,
  BoxProps,
  JustifyContent,
  SurfaceTheme,
} from "./Common";
import {mediaQueryLargerThan} from "./MediaQuery";
import {Unifier} from "./Unifier";

const ALIGN_CONTENT = {
  around: "space-around",
  between: "space-between",
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
};

const ALIGN_ITEMS = {
  baseline: "baseline",
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
};

const ALIGN_SELF = {
  around: "space-around",
  auto: "auto",
  baseline: "baseline",
  between: "space-between",
  center: "center",
  end: "flex-end",
  start: "flex-start",
  stretch: "stretch",
};

const BORDER_WIDTH = 1;

const isValidPercentage = (value: string): boolean => {
  return /^\d+(\.\d+)?%$/.test(value);
};

const isValidWidthHeight = (value: number | string): boolean => {
  return typeof value === "number" || !Number.isNaN(Number(value)) || isValidPercentage(value);
};

// eslint-disable-next-line react/display-name
export const Box = React.forwardRef((props: BoxProps, ref) => {
  const {theme} = useTheme();

  useImperativeHandle(ref, () => ({
    scrollTo: (y: number) => {
      if (scrollRef?.current) {
        // HACK HACK HACK...but it works. Probably need to do some onContentSizeChange or onLayout
        // to avoid this, but it works well enough.
        setTimeout(() => {
          scrollRef?.current?.scrollTo({y});
        }, 50);
      }
    },
    scrollToEnd: () => {
      if (scrollRef?.current) {
        // HACK HACK HACK...but it works. Probably need to do some onContentSizeChange or onLayout
        // to avoid this, but it works well enough.
        setTimeout(() => {
          scrollRef?.current?.scrollToEnd();
        }, 50);
      }
    },
  }));

  const BOX_STYLE_MAP: {
    [prop: string]: (
      value: any,
      all: {[prop: string]: any}
    ) => {[style: string]: string | number} | {};
  } = {
    alignContent: (value: AlignContent) => ({alignContent: ALIGN_CONTENT[value]}),
    alignItems: (value: AlignItems) => ({alignItems: ALIGN_ITEMS[value]}),
    alignSelf: (value: AlignSelf) => ({alignSelf: ALIGN_SELF[value]}),
    border: (value: keyof BorderTheme) => {
      if (!value) {
        return {};
      }
      return {borderColor: theme.border[value], borderWidth: BORDER_WIDTH};
    },
    borderBottom: (value: keyof BorderTheme) => {
      if (!value) {
        return {};
      }
      return {borderBottomColor: theme.border[value], borderBottomWidth: BORDER_WIDTH};
    },
    borderLeft: (value: keyof BorderTheme) => {
      if (!value) {
        return {};
      }
      return {borderLeftColor: theme.border[value], borderLeftWidth: BORDER_WIDTH};
    },
    borderRight: (value: keyof BorderTheme) => {
      if (!value) {
        return {};
      }
      return {borderRightColor: theme.border[value], borderRightWidth: BORDER_WIDTH};
    },
    borderTop: (value: keyof BorderTheme) => {
      if (!value) {
        return {};
      }
      return {borderTopColor: theme.border[value], borderTopWidth: BORDER_WIDTH};
    },
    bottom: (bottom) => ({bottom: bottom ? 0 : undefined}),
    color: (value: keyof SurfaceTheme) => ({backgroundColor: theme.surface[value]}),
    direction: (value: any) => ({display: "flex", flexDirection: value}),
    display: (value: any) => {
      if (value === "none") {
        return {display: "none"};
      }
      return value === "flex" ? {flex: undefined} : {flex: 0, flexDirection: "row"};
    },
    flex: (value: string) => {
      if (value === "grow") {
        return {display: "flex", flexGrow: 1, flexShrink: 1};
      } else if (value === "shrink") {
        return {display: "flex", flexShrink: 1};
      } else {
        return {display: "flex", flex: 0};
      }
    },
    gap: (value) => ({gap: getSpacing(value)}),
    height: (value) => {
      if (!isValidWidthHeight(value)) {
        console.warn(
          `Box: height prop must be a number or percentage string (e.g., "50%"), received: ${value}`
        );
        return {};
      }
      if (props.border && !Number.isNaN(Number(value))) {
        return {height: Number(value) + 2 * 2};
      } else {
        return {height: value};
      }
    },
    justifyContent: (value: JustifyContent) => ({justifyContent: ALIGN_CONTENT[value]}),
    left: (left) => ({left: left ? 0 : undefined}),
    lgDirection: (value: any) =>
      mediaQueryLargerThan("lg") ? {display: "flex", flexDirection: value} : {},
    margin: (value) => ({margin: getSpacing(value)}),
    marginBottom: (value) => ({marginBottom: getSpacing(value)}),
    marginLeft: (value) => ({marginLeft: getSpacing(value)}),
    marginRight: (value) => ({marginRight: getSpacing(value)}),
    marginTop: (value) => ({marginTop: getSpacing(value)}),
    maxHeight: (value) => {
      if (!isValidWidthHeight(value)) {
        console.warn(
          `Box: maxHeight prop must be a number or percentage string (e.g., "50%"), received: ${value}`
        );
        return {};
      }
      return {maxHeight: value};
    },
    maxWidth: (value) => {
      if (!isValidWidthHeight(value)) {
        console.warn(
          `Box: maxWidth prop must be a number or percentage string (e.g., "50%"), received: ${value}`
        );
        return {};
      }
      return {maxWidth: value};
    },
    mdDirection: (value: any) =>
      mediaQueryLargerThan("md") ? {display: "flex", flexDirection: value} : {},
    minHeight: (value) => {
      if (!isValidWidthHeight(value)) {
        console.warn(
          `Box: minHeight prop must be a number or percentage string (e.g., "50%"), received: ${value}`
        );
        return {};
      }
      return {minHeight: value};
    },
    minWidth: (value) => {
      if (!isValidWidthHeight(value)) {
        console.warn(
          `Box: minWidth prop must be a number or percentage string (e.g., "50%"), received: ${value}`
        );
        return {};
      }
      return {minWidth: value};
    },
    overflow: (value) => {
      if (value === "scrollY" || value === "scroll") {
        return {overflow: "scroll"};
      }
      return {overflow: value};
    },
    padding: (value) => ({padding: getSpacing(value)}),
    paddingX: (value) => ({paddingLeft: getSpacing(value), paddingRight: getSpacing(value)}),
    paddingY: (value) => ({paddingBottom: getSpacing(value), paddingTop: getSpacing(value)}),
    position: (value) => ({position: value}),
    right: (right) => ({right: right ? 0 : undefined}),
    rounding: (rounding, allProps) => {
      if (rounding === "circle") {
        if (!allProps.height && !allProps.width) {
          console.warn("Cannot use Box rounding='circle' without height or width.");
          return {borderRadius: undefined};
        }
        return {borderRadius: allProps.height || allProps.width};
      }

      if (rounding) {
        return {borderRadius: getRounding(rounding)};
      }

      return {borderRadius: undefined};
    },
    shadow: (value) => {
      if (!value) {
        return {};
      }
      if (Platform.OS === "ios" || Platform.OS === "web") {
        return {
          boxShadow: "2px 2px 2px rgba(153, 153, 153, 1.0)",
        };
      } else {
        return {elevation: 4};
      }
    },
    smDirection: (value: any) =>
      mediaQueryLargerThan("sm") ? {display: "flex", flexDirection: value} : {},
    top: (top) => ({top: top ? 0 : undefined}),
    width: (value) => {
      if (!isValidWidthHeight(value)) {
        console.warn(
          `Box: width prop must be a number or percentage string (e.g., "50%"), received: ${value}`
        );
        return {};
      }
      if (props.border && !Number.isNaN(Number(value))) {
        return {width: Number(value) + 2 * 2};
      } else {
        return {width: value};
      }
    },
    wrap: (value) => ({alignItems: "flex-start", flexWrap: value ? "wrap" : "nowrap"}),
    zIndex: (value) => ({zIndex: value ? value : undefined}),
  };

  const scrollRef = props.scrollRef ?? React.createRef();

  const propsToStyle = (): any => {
    let style: any = {};
    for (const prop of Object.keys(props) as Array<keyof typeof props>) {
      const value = props[prop];
      if (BOX_STYLE_MAP[prop]) {
        Object.assign(style, BOX_STYLE_MAP[prop](value, props));
      } else if (prop !== "children" && prop !== "onClick") {
        style[prop] = value;
        // console.warn(`Box: unknown property ${prop}`);
      }
    }

    if (props.wrap && props.alignItems && Platform.OS !== "web") {
      console.warn("React Native doesn't support wrap and alignItems together.");
    }

    // Finally, dangerously set overrides.
    if (props.dangerouslySetInlineStyle) {
      style = {...style, ...props.dangerouslySetInlineStyle.__style};
    }

    return style;
  };

  const onHoverIn = async () => {
    await props.onHoverStart?.();
  };

  const onHoverOut = async () => {
    await props.onHoverEnd?.();
  };

  let box;

  // Adding the accessibilityRole of button throws a warning in React Native since we nest buttons
  // within Box and RN does not support nested buttons
  if (props.onClick) {
    box = (
      <Pressable
        accessibilityHint={(props as AccessibilityProps).accessibilityHint}
        aria-label={(props as AccessibilityProps).accessibilityLabel}
        aria-role="button"
        onLayout={props.onLayout}
        onPointerEnter={onHoverIn}
        onPointerLeave={onHoverOut}
        onPress={async () => {
          await Unifier.utils.haptic();
          await props.onClick?.();
        }}
        style={propsToStyle()}
        testID={props.testID ? `${props.testID}-clickable` : undefined}
      >
        {props.children}
      </Pressable>
    );
  } else {
    box = (
      <View
        onPointerEnter={onHoverIn}
        onPointerLeave={onHoverOut}
        style={propsToStyle()}
        testID={props.testID}
      >
        {props.children}
      </View>
    );
  }

  if (props.scroll) {
    const {justifyContent, alignContent, alignItems, ...scrollStyle} = propsToStyle();

    box = (
      <ScrollView
        contentContainerStyle={{alignContent, alignItems, justifyContent}}
        horizontal={props.overflow === "scrollX"}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onScroll={(event) => {
          if (props.onScroll && event) {
            props.onScroll(event.nativeEvent.contentOffset.y);
          }
        }}
        ref={props.scrollRef || scrollRef}
        scrollEventThrottle={50}
        style={scrollStyle}
      >
        {box}
      </ScrollView>
    );
  }

  if (props.avoidKeyboard) {
    box = (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={props.keyboardOffset}
        style={{display: "flex", flex: 1}}
      >
        <SafeAreaView style={{display: "flex", flex: 1}}>{box}</SafeAreaView>
      </KeyboardAvoidingView>
    );
  }
  return box;
});
