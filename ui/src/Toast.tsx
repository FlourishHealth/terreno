import type React from "react";
import {Platform, Pressable, View} from "react-native";

import type {IconName, SurfaceColor, TextColor, ToastProps} from "./Common";
import {Heading} from "./Heading";
import {Icon} from "./Icon";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {useToastNotifications} from "./ToastNotifications";
import {isAPIError, printAPIError} from "./Utilities";

const TOAST_DURATION_MS = 3 * 1000;

type UseToastVariantOptions = {
  persistent?: ToastProps["persistent"];
  secondary?: ToastProps["secondary"];
  size?: ToastProps["size"];
  onDismiss?: ToastProps["onDismiss"];
  subtitle?: ToastProps["subtitle"];
};

type UseToastOptions = {variant?: ToastProps["variant"]} & UseToastVariantOptions;

export function useToast(): {
  hide: (id: string) => void;
  success: (title: string, options?: UseToastVariantOptions) => string;
  info: (title: string, options?: UseToastVariantOptions) => string;
  warn: (title: string, options?: UseToastVariantOptions) => string;
  error: (title: string, options?: UseToastVariantOptions) => string;
  show: (title: string, options?: UseToastOptions) => string;
  catch: (error: any, message?: string, options?: UseToastVariantOptions) => void;
} {
  const toast = useToastNotifications();
  const show = (title: string, options?: UseToastOptions): string => {
    if (!toast?.show) {
      console.warn("Toast not ready yet — provider ref may not be initialized");
      return "";
    }
    const toastData = {
      variant: "info",
      ...options,
      title,
    };
    return toast.show(title, {
      data: toastData,
      duration: options?.persistent ? 0 : TOAST_DURATION_MS,
    });
  };
  return {
    catch: (error: any, message?: string, options?: UseToastVariantOptions): void => {
      let exceptionMsg;
      if (isAPIError(error)) {
        // Get the error without details.
        exceptionMsg = `${message}: ${printAPIError(error)}`;
        console.error(exceptionMsg);
      } else {
        exceptionMsg = error?.message ?? error?.error ?? String(error);
        console.error(`${message}: ${exceptionMsg}`);
      }
      show(exceptionMsg, {...options, variant: "error"});
    },
    error: (title: string, options?: UseToastVariantOptions): string => {
      console.error(title);
      return show(title, {...options, variant: "error"});
    },
    hide: (id: string) => toast?.hide?.(id),
    info: (title: string, options?: UseToastVariantOptions): string => {
      console.info(title);
      return show(title, {...options, variant: "info"});
    },
    show,
    success: (title: string, options?: UseToastVariantOptions): string => {
      console.info(title);
      return show(title, {...options, variant: "success"});
    },
    warn: (title: string, options?: UseToastVariantOptions): string => {
      console.warn(title);
      return show(title, {...options, variant: "warning"});
    },
  };
}

// TODO: Support secondary version of Toast.
// TODO: Support dismissible version of Toast. Currently only persistent are dismissible.
export const Toast = ({
  title,
  variant = "info",
  secondary,
  size = "sm",
  onDismiss,
  persistent,
  // TODO enforce these should only show if size is "lg" with type discrinimation
  subtitle,
}: ToastProps): React.ReactElement => {
  const {theme} = useTheme();
  let color: SurfaceColor;
  let textColor: TextColor;
  let iconName: IconName;

  if (secondary) {
    throw new Error("Secondary not supported yet");
  }

  if (persistent && !onDismiss) {
    console.warn("Toast is persistent but no onDismiss callback provided");
  }

  if (variant === "warning") {
    color = "warning";
    textColor = "inverted";
    iconName = "triangle-exclamation";
  } else if (variant === "error") {
    color = "error";
    textColor = "inverted";
    iconName = "circle-exclamation";
  } else if (variant === "success") {
    color = "success";
    textColor = "inverted";
    iconName = "circle-check";
  } else {
    color = "neutralDark";
    textColor = "inverted";
    iconName = "circle-info";
  }

  return (
    <View
      style={{
        display: "flex",
        flexDirection: "row",
        flexGrow: 1,
        justifyContent: "center",
        marginTop: theme.spacing.sm,
        maxWidth: Platform.OS === "web" ? 900 : "100%",
        paddingLeft: Platform.OS === "web" ? "10%" : theme.spacing.sm,
        paddingRight: Platform.OS === "web" ? "10%" : theme.spacing.sm,
        width: "100%",
      }}
    >
      <View
        style={{
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: theme.surface[color],
          borderRadius: theme.radius.default,
          display: "flex",
          flexDirection: "row",
          flexShrink: 1,
          gap: 10,
          maxWidth: "100%", // Ensure the content does not overflow
          minHeight: size === "lg" ? 32 : undefined,
          minWidth: 150,
          paddingBottom: theme.spacing.xs,
          paddingRight: theme.spacing.sm,
          paddingTop: theme.spacing.xs,
        }}
      >
        <View
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "row",
            flexGrow: 1,
            flexShrink: 1, // Ensure the content can shrink properly
            gap: 12,
            maxWidth: "100%",
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          <View
            style={{
              alignItems: size === "lg" ? "center" : undefined,
              alignSelf: size === "lg" ? "stretch" : undefined,
              borderBottomLeftRadius: theme.radius.default,
              borderTopLeftRadius: theme.radius.default,
              display: "flex",
              flexDirection: "row",
              paddingBottom: size === "lg" ? 8 : 0,
              paddingLeft: size === "lg" ? 4 : 0,
              paddingRight: size === "lg" ? 4 : 0,
              paddingTop: size === "lg" ? 8 : 0,
            }}
          >
            <Icon color={textColor} iconName={iconName} size={size === "lg" ? "2xl" : "md"} />
          </View>
          <View
            style={{
              alignItems: "flex-start",
              alignSelf: "stretch",
              display: "flex",
              flexDirection: "column",
              flexShrink: 1, // Ensure the content can shrink properly
              flexWrap: "wrap",
              gap: 2,
              justifyContent: "center",
              paddingBottom: 8,
              paddingTop: 8,
            }}
          >
            {size === "lg" ? (
              <Heading color={textColor} size="sm">
                {title}
              </Heading>
            ) : (
              <Text bold color={textColor} size="md">
                {title}
              </Text>
            )}
            {Boolean(size === "lg" && subtitle) && (
              <Text color={textColor} size="sm">
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {Boolean(persistent && onDismiss) && (
          <Pressable
            aria-role="button"
            onPress={onDismiss}
            style={{
              alignItems: "center",
              alignSelf: "center",
              display: "flex",
              gap: 12,
              marginLeft: 10,
              padding: size === "lg" ? 8 : 0,
            }}
          >
            <Icon color={textColor} iconName="xmark" />
          </Pressable>
        )}
      </View>
    </View>
  );
};
