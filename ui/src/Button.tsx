import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import debounce from "lodash/debounce";
import {
  type CustomPressableProps,
  PressableOpacity,
  PressableScale,
  PressableWithoutFeedback,
} from "pressto";
import type React from "react";
import {lazy, Suspense, useCallback, useMemo, useState} from "react";
import {ActivityIndicator, Pressable, type PressableProps, Text, View} from "react-native";

import {Box} from "./Box";
import type {ButtonPressAnimation, ButtonProps} from "./Common";
import {useCustomIcon} from "./IconRegistry";
import {isMobileDevice} from "./MediaQuery";
import {useTheme} from "./Theme";
import {Tooltip} from "./Tooltip";
import {Unifier} from "./Unifier";
import {isNative} from "./Utilities";

// Lazy load Modal to break the circular dependency: Modal -> Button -> Modal
const LazyModal = lazy(() => import("./Modal").then((module) => ({default: module.Modal})));

const DEFAULT_BUTTON_PRESS_ANIMATION: ButtonPressAnimation = "scale";

const PRESSABLE_BY_ANIMATION: Record<
  ButtonPressAnimation,
  React.ComponentType<CustomPressableProps>
> = {
  none: PressableWithoutFeedback,
  opacity: PressableOpacity,
  scale: PressableScale,
};

type ButtonPressableProps = CustomPressableProps & PressableProps;

const ButtonComponent: React.FC<ButtonProps> = ({
  confirmationText = "Are you sure you want to continue?",
  disabled = false,
  fullWidth = false,
  iconName,
  iconPosition = "left",
  loading: propsLoading,
  modalTitle = "Confirm",
  modalSubTitle,
  pressAnimation = DEFAULT_BUTTON_PRESS_ANIMATION,
  size = "default",
  state = "default",
  testID,
  text,
  variant = "primary",
  withConfirmation = false,
  onClick,
}) => {
  const [loading, setLoading] = useState(propsLoading);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const {theme} = useTheme();
  const CustomIcon = useCustomIcon(iconName);

  const {backgroundColor, borderColor, borderWidth, color} = useMemo(() => {
    if (!theme) {
      return {};
    }
    let bgColor = theme.surface.primary;
    let bColor: string | undefined;
    let bWidth: number | undefined;
    let textColor = theme.text.inverted;

    if (disabled) {
      bgColor = theme.surface.disabled;
    } else if (variant === "secondary") {
      bgColor = theme.surface.secondaryDark;
    } else if (variant === "muted") {
      bgColor = theme.surface.secondaryLight;
      textColor = theme.surface.neutralDark;
    } else if (variant === "outline") {
      bgColor = theme.surface.base;
      bColor = theme.text.secondaryDark;
      bWidth = 2;
      textColor = theme.text.secondaryDark;
    } else if (variant === "destructive") {
      bgColor = theme.surface.error;
    } else if (variant === "ghost") {
      bgColor = "transparent";
      textColor = theme.surface.secondaryDark;
    }

    if (!disabled && state === "active") {
      if (variant === "primary") {
        bgColor = theme.surface.secondaryDark;
      } else if (variant === "destructive") {
        bgColor = theme.surface.error;
      } else {
        bgColor = theme.surface.primary;
      }
      textColor = theme.surface.base;
    }

    return {
      backgroundColor: bgColor,
      borderColor: bColor,
      borderWidth: bWidth,
      color: textColor,
    };
  }, [disabled, state, variant, theme]);

  const handlePress = useCallback(async (): Promise<void> => {
    await Unifier.utils.haptic();
    setLoading(true);

    try {
      // If a confirmation is required, and the confirmation modal is not currently open,
      // open it.
      if (withConfirmation && !showConfirmation) {
        setShowConfirmation(true);
      } else if (!withConfirmation && onClick) {
        // If a confirmation is not required, perform the action.
        await onClick();
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
    setLoading(false);
  }, [onClick, showConfirmation, withConfirmation]);

  const debouncedHandlePress = useMemo(
    () => debounce(handlePress, 500, {leading: true, trailing: false}),
    [handlePress]
  );

  if (!theme) {
    return null;
  }

  const isPressDisabled = disabled || Boolean(loading);
  const PressableComponent = (
    isPressDisabled ? Pressable : PRESSABLE_BY_ANIMATION[pressAnimation]
  ) as React.ComponentType<ButtonPressableProps>;
  const pressableInteractionProps = isPressDisabled ? {disabled: true} : {enabled: true};

  return (
    <PressableComponent
      accessibilityHint={
        withConfirmation ? "Opens a confirmation dialog" : "Press to perform action"
      }
      accessibilityLabel={text}
      accessibilityRole="button"
      accessibilityState={{disabled: isPressDisabled}}
      {...pressableInteractionProps}
      onPress={debouncedHandlePress}
      style={{
        alignItems: "center",
        alignSelf: fullWidth ? "stretch" : "flex-start",
        backgroundColor,
        borderColor,
        borderRadius: theme.radius.rounded,
        borderWidth,
        flexDirection: "column",
        height: size === "sm" ? 28 : undefined,
        justifyContent: "center",
        paddingHorizontal: size === "sm" ? 16 : 20,
        paddingVertical: size === "sm" ? 0 : 8 - (borderWidth ?? 0),
        width: fullWidth ? "100%" : "auto",
      }}
      testID={testID}
    >
      <View style={{flexDirection: "row"}}>
        <View style={{flexDirection: iconPosition === "left" ? "row" : "row-reverse"}}>
          {Boolean(iconName) && (
            <View
              style={{
                alignSelf: "center",
                marginLeft: iconPosition === "right" ? 8 : 0,
                marginRight: iconPosition === "left" ? 8 : 0,
              }}
            >
              {CustomIcon ? (
                <CustomIcon color={color ?? theme.text.inverted} size={size === "sm" ? 12 : 16} />
              ) : (
                <FontAwesome6 color={color} name={iconName} size={size === "sm" ? 12 : 16} solid />
              )}
            </View>
          )}
          <Text style={{color, fontSize: size === "sm" ? 14 : 16, fontWeight: "700"}}>{text}</Text>
        </View>
        {Boolean(loading) && (
          <Box marginLeft={2}>
            <ActivityIndicator color={color} size="small" />
          </Box>
        )}
      </View>
      {withConfirmation && showConfirmation && (
        <Suspense fallback={null}>
          <LazyModal
            onDismiss={() => setShowConfirmation(false)}
            primaryButtonOnClick={async (): Promise<void> => {
              await onClick();
              setShowConfirmation(false);
            }}
            primaryButtonText="Confirm"
            secondaryButtonOnClick={() => setShowConfirmation(false)}
            secondaryButtonText="Cancel"
            subtitle={modalSubTitle}
            text={confirmationText}
            title={modalTitle}
            visible={showConfirmation}
          />
        </Suspense>
      )}
    </PressableComponent>
  );
};

export const Button: React.FC<ButtonProps> = (props) => {
  const {tooltipText, tooltipIdealPosition, tooltipIncludeArrow = false} = props;
  const isMobileOrNative = isMobileDevice() || isNative();

  if (tooltipText && !isMobileOrNative) {
    return (
      <Tooltip
        idealPosition={tooltipIdealPosition}
        includeArrow={tooltipIncludeArrow}
        text={tooltipText}
      >
        <ButtonComponent {...props} />
      </Tooltip>
    );
  }

  return <ButtonComponent {...props} />;
};
