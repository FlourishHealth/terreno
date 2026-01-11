import type {FC} from "react";
import {
  Dimensions,
  type DimensionValue,
  Pressable,
  Modal as RNModal,
  Text,
  View,
} from "react-native";

import {Heading} from "./Heading";
import {useTheme} from "./Theme";

export interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const getModalSize = (): DimensionValue => {
  const sizePx = 540;
  if (sizePx > Dimensions.get("window").width) {
    return "90%";
  }
  return sizePx;
};

export const ConfirmationDialog: FC<ConfirmationDialogProps> = ({
  visible,
  title,
  subtitle,
  text,
  onConfirm,
  onCancel,
}) => {
  const {theme} = useTheme();

  if (!theme) {
    return null;
  }

  const sizePx = getModalSize();

  return (
    <RNModal animationType="none" onRequestClose={onCancel} transparent visible={visible}>
      <Pressable
        onPress={onCancel}
        style={{
          alignItems: "center",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <Pressable onPress={(e) => e.stopPropagation()} style={{cursor: "auto"}}>
          <View
            style={{
              alignItems: "center",
              alignSelf: "center",
              backgroundColor: theme.surface.base,
              borderRadius: theme.radius.default,
              boxShadow: "0px 4px 24px rgba(0, 0, 0, 0.5)",
              elevation: 24,
              margin: "auto",
              maxHeight: "100%",
              padding: 32,
              width: sizePx,
              zIndex: 1,
            }}
          >
            <View
              accessibilityHint="Modal title"
              aria-label={title}
              aria-role="header"
              style={{alignSelf: "flex-start"}}
            >
              <Heading size="lg">{title}</Heading>
            </View>
            {subtitle && (
              <View
                accessibilityHint="Modal Sub Heading Text"
                aria-label={subtitle}
                aria-role="text"
                style={{alignSelf: "flex-start", marginTop: 8}}
              >
                <Text style={{color: theme.text.primary, fontSize: 18}}>{subtitle}</Text>
              </View>
            )}
            <View
              accessibilityHint="Modal body text"
              aria-label={text}
              aria-role="text"
              style={{alignSelf: "flex-start", marginVertical: 12}}
            >
              <Text style={{color: theme.text.primary, fontSize: 16}}>{text}</Text>
            </View>
            <View
              style={{
                alignSelf: "flex-end",
                flexDirection: "row",
                marginTop: 20,
              }}
            >
              <Pressable
                accessibilityHint="Press to cancel"
                aria-label="Cancel"
                aria-role="button"
                onPress={onCancel}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.surface.secondaryLight,
                  borderRadius: theme.radius.rounded,
                  justifyContent: "center",
                  marginRight: 20,
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                }}
              >
                <Text style={{color: theme.surface.neutralDark, fontSize: 16, fontWeight: "700"}}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityHint="Press to confirm"
                aria-label="Confirm"
                aria-role="button"
                onPress={onConfirm}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.surface.primary,
                  borderRadius: theme.radius.rounded,
                  justifyContent: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                }}
              >
                <Text style={{color: theme.text.inverted, fontSize: 16, fontWeight: "700"}}>
                  Confirm
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </RNModal>
  );
};
