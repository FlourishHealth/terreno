// MIT License

// Copyright (c) LawnStarter

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Forked 2021/11/26 by Josh Gachnang <josh@nang.io> from version 8.0.3 because it conflicted
// with react-native-picker in Expo, then converted to TS.

import {Picker} from "@react-native-picker/picker";
import isEqual from "lodash/isEqual";
import {useCallback, useEffect, useMemo, useState} from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {Icon} from "./Icon";
import {useTheme} from "./Theme";

export const defaultStyles = StyleSheet.create({
  chevron: {
    backgroundColor: "transparent",
    borderColor: "#a1a1a1",
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    height: 15,
    width: 15,
  },

  chevronActive: {
    borderColor: "#007aff",
  },
  viewContainer: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 40,
    width: "100%",
  },
});

export interface RNPickerSelectProps {
  onValueChange: (value: any, index: any) => void;
  items: any[];
  value?: any;
  placeholder?: any;
  disabled?: boolean;
  itemKey?: string | number;
  children?: any;
  onOpen?: () => void;
  useNativeAndroidPickerStyle?: boolean;
  fixAndroidTouchableBug?: boolean;

  // Custom Modal props (iOS only)
  doneText?: string;
  onDonePress?: () => void;
  onUpArrow?: () => void;
  onDownArrow?: () => void;
  onClose?: () => void;

  // Modal props (iOS only)
  modalProps?: any;

  // TextInput props
  textInputProps?: any;

  // Touchable Done props (iOS only)
  touchableDoneProps?: any;

  // Touchable wrapper props
  touchableWrapperProps?: any;

  InputAccessoryView?: any;
}

export function RNPickerSelect({
  onValueChange,
  value,
  items,
  placeholder,
  disabled = false,
  itemKey,
  children,
  useNativeAndroidPickerStyle = true,
  fixAndroidTouchableBug = false,
  doneText = "Done",
  onDonePress,
  onUpArrow,
  onDownArrow,
  onOpen,
  onClose,
  modalProps,
  textInputProps,
  touchableDoneProps,
  touchableWrapperProps,

  InputAccessoryView,
}: RNPickerSelectProps) {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [animationType, setAnimationType] = useState(undefined);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [doneDepressed, setDoneDepressed] = useState<boolean>(false);
  const {theme} = useTheme();

  const options = useMemo(() => {
    if (isEqual(placeholder, {})) {
      return [...items];
    } else {
      return [placeholder, ...items];
    }
  }, [items, placeholder]);

  const getSelectedItem = useCallback(
    (key: any, val: any) => {
      let idx = options.findIndex((item: any) => {
        if (item.key && key) {
          return isEqual(item.key, key);
        }
        return isEqual(item.value, val);
      });
      if (idx === -1) {
        idx = 0;
      }
      return {
        idx,
        selectedItem: options[idx] || {},
      };
    },
    [options]
  );

  const [selectedItem, setSelectedItem] = useState<any>(() => {
    return getSelectedItem(itemKey, value).selectedItem;
  });

  // Set selected item
  useEffect(() => {
    const item = getSelectedItem(itemKey, value);
    setSelectedItem(item.selectedItem);
  }, [getSelectedItem, itemKey, value]);

  const onUpArrowEvent = () => {
    togglePicker(false, onUpArrow);
  };

  const onDownArrowEvent = () => {
    togglePicker(false, onDownArrow);
  };

  const onValueChangeEvent = (val: any, index: any) => {
    const item = getSelectedItem(itemKey, val);
    onValueChange(val, index);
    setSelectedItem(item.selectedItem);
  };

  const onOrientationChange = ({nativeEvent}: any) => {
    setOrientation(nativeEvent.orientation);
  };

  const triggerOpenCloseCallbacks = () => {
    if (!showPicker && onOpen) {
      onOpen();
    }

    if (showPicker && onClose) {
      onClose();
    }
  };

  const togglePicker = (animate = false, postToggleCallback?: any) => {
    if (disabled) {
      return;
    }

    if (!showPicker) {
      Keyboard.dismiss();
    }

    setAnimationType(modalProps?.animationType ? modalProps?.animationType : "slide");

    triggerOpenCloseCallbacks();

    setAnimationType(animate ? animationType : undefined);
    setShowPicker(!showPicker);

    if (postToggleCallback) {
      postToggleCallback();
    }
  };

  const renderPickerItems = () => {
    return options?.map((item: any) => {
      return (
        <Picker.Item
          color={item.color}
          key={item.key || item.label}
          label={item.label}
          value={item.value}
        />
      );
    });
  };

  const renderInputAccessoryView = () => {
    if (InputAccessoryView) {
      return <InputAccessoryView testID="custom_input_accessory_view" />;
    }

    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#f8f8f8",
          borderTopColor: "#dedede",
          borderTopWidth: 1,
          flexDirection: "row",
          height: 45,
          justifyContent: "space-between",
          paddingHorizontal: 10,
          zIndex: 2,
        }}
        testID="input_accessory_view"
      >
        <View
          style={{
            flexDirection: "row",
          }}
        >
          {Boolean(onUpArrow) && (
            <TouchableOpacity
              activeOpacity={onUpArrow ? 0.5 : 1}
              aria-role="button"
              onPress={onUpArrow ? onUpArrowEvent : undefined}
            >
              <View
                // chevron up
                style={[
                  defaultStyles.chevron,
                  {
                    marginLeft: 11,
                    transform: [{translateY: 4}, {rotate: "-45deg"}],
                  },
                  onUpArrow ? [defaultStyles.chevronActive] : {},
                ]}
              />
            </TouchableOpacity>
          )}
          {Boolean(onDownArrow) && (
            <TouchableOpacity
              activeOpacity={onDownArrow ? 0.5 : 1}
              aria-role="button"
              onPress={onDownArrow ? onDownArrowEvent : undefined}
            >
              <View
                // chevron down
                style={[
                  defaultStyles.chevron,
                  {
                    marginLeft: 22,
                    transform: [{translateY: -5}, {rotate: "135deg"}],
                  },
                  onDownArrow ? [defaultStyles.chevronActive] : {},
                ]}
              />
            </TouchableOpacity>
          )}
        </View>
        <Pressable
          hitSlop={{bottom: 4, left: 4, right: 4, top: 4}}
          onPress={() => {
            togglePicker(true, onDonePress);
          }}
          onPressIn={() => {
            setDoneDepressed(true);
          }}
          onPressOut={() => {
            setDoneDepressed(false);
          }}
          testID="done_button"
          {...touchableDoneProps}
        >
          <View testID="needed_for_touchable">
            <Text
              allowFontScaling={false}
              style={[
                {
                  color: "#007aff",
                  fontSize: 17,
                  fontWeight: "600",
                  paddingRight: 11,
                  paddingTop: 1,
                },
                doneDepressed
                  ? {
                      fontSize: 19,
                    }
                  : {},
              ]}
              testID="done_text"
            >
              {doneText}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  const renderIcon = () => {
    // Icon only needed for iOS, web and android use default icons
    if (Platform.OS !== "ios") {
      return null;
    }

    return (
      <View style={{pointerEvents: "none"}} testID="icon_container">
        <Icon color={disabled ? "secondaryLight" : "primary"} iconName="angle-down" size="sm" />
      </View>
    );
  };

  const renderTextInputOrChildren = () => {
    if (children) {
      return <View style={{pointerEvents: "box-only"}}>{children}</View>;
    }

    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          pointerEvents: "box-only",
          width: "100%",
        }}
      >
        <TextInput
          readOnly
          style={{color: disabled ? theme.text.secondaryLight : theme.text.primary}}
          testID="text_input"
          value={selectedItem?.inputLabel ? selectedItem?.inputLabel : selectedItem?.label}
          {...textInputProps}
        />
        {renderIcon()}
      </View>
    );
  };

  const renderIOS = () => {
    return (
      <View
        style={[
          defaultStyles.viewContainer,
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.dark,
          },
          disabled && {
            backgroundColor: theme.surface.neutralLight,
            borderColor: theme.border.activeNeutral,
          },
        ]}
      >
        <Pressable
          activeOpacity={1}
          onPress={() => {
            togglePicker(true);
          }}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            minHeight: 40,
            width: "95%",
          }}
          testID="ios_touchable_wrapper"
          {...touchableWrapperProps}
        >
          {renderTextInputOrChildren()}
        </Pressable>
        <Modal
          animationType={animationType}
          onOrientationChange={onOrientationChange}
          supportedOrientations={["portrait", "landscape"]}
          testID="ios_modal"
          transparent
          visible={showPicker}
          {...modalProps}
        >
          <Pressable
            aria-role="button"
            onPress={() => {
              togglePicker(true);
            }}
            style={{
              flex: 1,
            }}
            testID="ios_modal_top"
          />
          {renderInputAccessoryView()}
          <View
            style={[
              {
                backgroundColor: "#d0d4da",
                justifyContent: "center",
              },
              {height: orientation === "portrait" ? 215 : 162},
            ]}
          >
            <Picker
              onValueChange={onValueChangeEvent}
              selectedValue={selectedItem?.value}
              testID="ios_picker"
            >
              {renderPickerItems()}
            </Picker>
          </View>
        </Modal>
      </View>
    );
  };

  const renderAndroidHeadless = () => {
    const Component: any = fixAndroidTouchableBug ? View : Pressable;
    return (
      <Component
        activeOpacity={1}
        onPress={onOpen}
        testID="android_touchable_wrapper"
        {...touchableWrapperProps}
      >
        <View>
          {renderTextInputOrChildren()}
          <Picker
            enabled={!disabled}
            onValueChange={onValueChangeEvent}
            selectedValue={selectedItem?.value}
            style={[
              // to hide native icon
              Platform.OS !== "web" ? {backgroundColor: "transparent"} : {},
              {
                color: "transparent",
                height: "100%",
                opacity: 0,
                position: "absolute",
                width: "100%",
              },
            ]}
            testID="android_picker_headless"
          >
            {renderPickerItems()}
          </Picker>
        </View>
      </Component>
    );
  };

  const renderAndroidNativePickerStyle = () => {
    return (
      <View
        style={[
          defaultStyles.viewContainer,
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.dark,
            height: 40,
          },
          disabled && {
            backgroundColor: theme.surface.neutralLight,
            borderColor: theme.border.activeNeutral,
          },
        ]}
      >
        <Picker
          dropdownIconColor={theme.text.primary}
          enabled={!disabled}
          onValueChange={onValueChangeEvent}
          selectedValue={selectedItem?.value}
          style={[{color: theme.text.primary, width: "100%"}]}
          testID="android_picker"
        >
          {renderPickerItems()}
        </Picker>
      </View>
    );
  };

  // TODO: Create custom React component for web in order to apply library style rules
  const renderWeb = () => {
    return (
      <View
        style={[
          defaultStyles.viewContainer,
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.dark,
          },
          disabled && {
            backgroundColor: theme.surface.neutralLight,
            borderColor: theme.border.activeNeutral,
          },
        ]}
      >
        <Picker
          enabled={!disabled}
          onValueChange={onValueChangeEvent}
          selectedValue={selectedItem?.value}
          style={[
            {
              backgroundColor: theme.surface.base,
              borderColor: "black",
              borderRadius: 4,
              borderWidth: 0,
              height: "100%",
              paddingHorizontal: 8,
              paddingVertical: 8,
              width: "100%",
            },
            disabled && {
              backgroundColor: theme.surface.neutralLight,
              color: theme.text.secondaryLight,
              opacity: 1,
            },
          ]}
          testID="web_picker"
        >
          {renderPickerItems()}
        </Picker>
      </View>
    );
  };

  const render = () => {
    if (Platform.OS === "ios") {
      return renderIOS();
    }

    if (Platform.OS === "web") {
      return renderWeb();
    }

    if (children || !useNativeAndroidPickerStyle) {
      return renderAndroidHeadless();
    }

    return renderAndroidNativePickerStyle();
  };

  return render();
}
