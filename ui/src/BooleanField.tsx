import {type FC, useCallback, useEffect, useRef} from "react";
import {Animated, TouchableWithoutFeedback, View} from "react-native";

import type {BooleanFieldProps} from "./Common";
import {FieldHelperText, FieldTitle} from "./fieldElements";
import {Text} from "./Text";
import {useTheme} from "./Theme";

const TOUCHABLE_SIZE = 20;
const OFFSET = 10;
const WIDTH = 36;
const WIDTH_WITH_OFFSET = OFFSET + WIDTH;

export const BooleanField: FC<BooleanFieldProps> = ({
  title,
  variant,
  value,
  onChange,
  disabled,
  disabledHelperText,
  helperText,
}) => {
  const {theme} = useTheme();
  const backgroundColor = useRef(
    new Animated.Value(value ? WIDTH_WITH_OFFSET : -1 * WIDTH_WITH_OFFSET)
  ).current;
  const circleColor = useRef(
    new Animated.Value(value ? WIDTH_WITH_OFFSET : -1 * WIDTH_WITH_OFFSET)
  ).current;
  const circleBorderColor = useRef(
    new Animated.Value(value ? WIDTH_WITH_OFFSET : -1 * WIDTH_WITH_OFFSET)
  ).current;
  const transformSwitch = useRef(new Animated.Value(value ? OFFSET : -1 * OFFSET)).current;

  const animateSwitch = useCallback(
    (newValue: boolean) => {
      Animated.parallel([
        Animated.spring(transformSwitch, {
          toValue: newValue ? OFFSET : -1 * OFFSET,
          useNativeDriver: false,
        }),
        Animated.timing(backgroundColor, {
          duration: 200,
          toValue: newValue ? WIDTH_WITH_OFFSET : -1 * WIDTH_WITH_OFFSET,
          useNativeDriver: false,
        }),
        Animated.timing(circleColor, {
          duration: 200,
          toValue: newValue ? WIDTH_WITH_OFFSET : -1 * WIDTH_WITH_OFFSET,
          useNativeDriver: false,
        }),
        Animated.timing(circleBorderColor, {
          duration: 200,
          toValue: value ? WIDTH_WITH_OFFSET : -1 * WIDTH_WITH_OFFSET,
          useNativeDriver: false,
        }),
      ]).start();
    },
    [backgroundColor, circleColor, circleBorderColor, transformSwitch, value]
  );

  const handleSwitch = () => {
    if (disabled) {
      return;
    }
    animateSwitch(!value);
    onChange(!value);
  };

  // Update animation when value changes without pressing
  useEffect(() => {
    animateSwitch(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animateSwitch]);

  const interpolatedColorAnimation = backgroundColor.interpolate({
    inputRange: [-1 * WIDTH_WITH_OFFSET, WIDTH_WITH_OFFSET],
    outputRange: [theme.surface.base, theme.surface.secondaryDark],
  });

  return (
    <View
      style={{
        alignItems: "flex-start",
        flexDirection: "column",
      }}
    >
      <View
        style={{
          alignItems: variant === "title" ? "flex-start" : "center",
          flexDirection: variant === "title" ? "column" : "row",
          justifyContent: variant === "title" ? "flex-start" : "center",
        }}
      >
        {Boolean(title) && <FieldTitle text={title!} />}
        <TouchableWithoutFeedback aria-role="button" onPress={handleSwitch}>
          <View style={{alignItems: "center", flexDirection: "row", justifyContent: "center"}}>
            <Animated.View
              style={{
                backgroundColor: disabled ? theme.surface.disabled : interpolatedColorAnimation,
                borderColor: disabled ? theme.surface.disabled : theme.surface.secondaryDark,
                borderRadius: TOUCHABLE_SIZE,
                borderWidth: 1,
                height: TOUCHABLE_SIZE,
                marginHorizontal: variant === "title" ? undefined : OFFSET,
                marginRight: variant === "title" ? OFFSET : undefined,
                width: WIDTH,
              }}
            >
              <Animated.View
                style={{
                  alignItems: "center",
                  flex: 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  left: transformSwitch,
                  width: WIDTH,
                }}
              >
                <Animated.View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.surface.base,
                    borderColor: disabled ? theme.surface.disabled : theme.surface.secondaryDark,
                    borderRadius: 10,
                    borderWidth: 1,
                    height: TOUCHABLE_SIZE,
                    justifyContent: "center",
                    width: TOUCHABLE_SIZE,
                  }}
                />
              </Animated.View>
            </Animated.View>
            {variant === "title" && <Text size="md">FUCK {value ? "Yes" : "No"}</Text>}
          </View>
        </TouchableWithoutFeedback>
      </View>
      {disabled && disabledHelperText && <FieldHelperText text={disabledHelperText} />}
      {Boolean(helperText) && <FieldHelperText text={helperText as string} />}
    </View>
  );
};
