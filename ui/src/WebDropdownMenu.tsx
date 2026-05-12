import {type ReactElement, useRef, useState} from "react";
import {
  type DimensionValue,
  Modal,
  Pressable,
  ScrollView,
  Text,
  type TextStyle,
  View,
} from "react-native";

import {useTheme} from "./Theme";

export interface WebDropdownMenuOption {
  key?: string | number;
  label: string;
  value: string;
  color?: string;
}

export interface WebDropdownAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WebDropdownMenuProps {
  /** Controls visibility of the popup. */
  visible: boolean;
  /** Position of the trigger element so the menu can be anchored beneath it. */
  anchor: WebDropdownAnchor;
  /** Options to render in the list. */
  options: WebDropdownMenuOption[];
  /** Currently selected value (used to highlight the matching option). */
  selectedValue?: string;
  /**
   * Optional index of the currently selected option. When provided, takes
   * precedence over `selectedValue` — useful when option values aren't
   * unique (e.g. a placeholder with an empty value sharing the same string
   * representation as another option).
   */
  selectedIndex?: number;
  /** Called when an option is chosen. */
  onSelect: (value: string, index: number) => void;
  /** Called when the backdrop is pressed or Escape is hit. */
  onClose: () => void;
  /** Optional fixed width for the menu. Defaults to the trigger width. */
  width?: DimensionValue;
  /** Optional minimum width for the menu. */
  minWidth?: DimensionValue;
  /** Additional style applied to each option's label. */
  optionTextStyle?: TextStyle;
  /** Prefix for the testIDs on the menu / backdrop / option nodes. */
  testIDPrefix?: string;
}

interface PressableWebState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Shared web-only popup used by `RNPickerSelect` and `SelectBadge` so every
 * browser renders the same styled dropdown instead of falling back to the
 * platform-native `<select>` UI. Must be anchored to a trigger element via
 * `useWebDropdownAnchor` (or an equivalent measurement).
 */
export const WebDropdownMenu = ({
  visible,
  anchor,
  options,
  selectedValue,
  selectedIndex,
  onSelect,
  onClose,
  width,
  minWidth,
  optionTextStyle,
  testIDPrefix = "web_dropdown",
}: WebDropdownMenuProps): ReactElement => {
  const {theme} = useTheme();

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      testID={`${testIDPrefix}_modal`}
      transparent
      visible={visible}
    >
      <Pressable
        aria-role="button"
        onPress={onClose}
        style={{flex: 1}}
        testID={`${testIDPrefix}_backdrop`}
      />
      <View
        style={{
          backgroundColor: theme.surface.base,
          borderColor: theme.border.dark,
          borderRadius: 4,
          borderWidth: 1,
          left: anchor.x,
          maxHeight: 300,
          minWidth,
          overflow: "hidden",
          position: "absolute",
          shadowColor: "#000",
          shadowOffset: {height: 2, width: 0},
          shadowOpacity: 0.15,
          shadowRadius: 8,
          top: anchor.y + anchor.height + 4,
          width: width ?? anchor.width,
        }}
        testID={`${testIDPrefix}_menu`}
      >
        <ScrollView>
          {options.map((item, idx) => {
            const isSelected =
              selectedIndex !== undefined ? idx === selectedIndex : item.value === selectedValue;
            return (
              <Pressable
                aria-role="button"
                key={item.key ?? idx}
                onPress={() => onSelect(item.value, idx)}
                style={(state: PressableWebState) => ({
                  backgroundColor:
                    isSelected || state.hovered || state.pressed
                      ? theme.surface.neutralLight
                      : theme.surface.base,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                })}
                testID={`${testIDPrefix}_option_${item.value}`}
              >
                <Text
                  style={{
                    color: item.color ?? theme.text.primary,
                    fontWeight: isSelected ? "600" : "400",
                    ...optionTextStyle,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

/**
 * Hook that wires up a `View` ref + anchor state for use with
 * `WebDropdownMenu`. Measure the trigger via `measure()` before opening so
 * the menu lines up beneath it across browsers.
 */
export const useWebDropdownAnchor = (): {
  triggerRef: React.RefObject<View | null>;
  anchor: WebDropdownAnchor;
  measure: (onMeasured: (anchor: WebDropdownAnchor) => void) => void;
} => {
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<WebDropdownAnchor>({height: 0, width: 0, x: 0, y: 0});

  const measure = (onMeasured: (next: WebDropdownAnchor) => void): void => {
    const node = triggerRef.current;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x, y, w, h) => {
        const next = {height: h, width: w, x, y};
        setAnchor(next);
        onMeasured(next);
      });
      return;
    }
    onMeasured(anchor);
  };

  return {anchor, measure, triggerRef};
};
