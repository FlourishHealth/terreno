import {type ReactElement, useLayoutEffect, useRef, useState} from "react";
import {
  type DimensionValue,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextStyle,
  View,
} from "react-native";

import type {TextStyleWithOutline} from "./Common";
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
  /** Whether to show a search input at the top of the dropdown for filtering options. */
  searchable?: boolean;
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
  searchable = false,
}: WebDropdownMenuProps): ReactElement => {
  const {theme} = useTheme();
  const [searchText, setSearchText] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  // Reset search text when the menu opens/closes and auto-focus the input
  useLayoutEffect(() => {
    if (visible) {
      setSearchText("");
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
  }, [visible, searchable]);

  const filteredOptions =
    searchable && searchText
      ? options.filter((item) => item.label.toLowerCase().includes(searchText.toLowerCase()))
      : options;

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
        {searchable && (
          <View
            style={{
              borderBottomColor: theme.border.dark,
              borderBottomWidth: 1,
              paddingHorizontal: 8,
              paddingVertical: 6,
            }}
          >
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchText}
              placeholder="Search…"
              placeholderTextColor={theme.text.secondaryLight}
              ref={searchInputRef}
              style={
                {
                  color: theme.text.primary,
                  fontSize: 14,
                  minHeight: 32,
                  outline: "none",
                  paddingHorizontal: 4,
                  paddingVertical: 4,
                } as TextStyleWithOutline
              }
              testID={`${testIDPrefix}_search_input`}
              value={searchText}
            />
          </View>
        )}
        <ScrollView keyboardShouldPersistTaps="handled">
          {filteredOptions.length === 0 && searchable && searchText ? (
            <View style={{paddingHorizontal: 12, paddingVertical: 10}}>
              <Text style={{color: theme.text.secondaryLight, fontStyle: "italic"}}>
                No matching options
              </Text>
            </View>
          ) : (
            filteredOptions.map((item) => {
              const originalIdx = options.indexOf(item);
              const isSelected =
                selectedIndex !== undefined
                  ? originalIdx === selectedIndex
                  : item.value === selectedValue;
              return (
                <Pressable
                  aria-role="button"
                  key={item.key ?? originalIdx}
                  onPress={() => onSelect(item.value, originalIdx)}
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
            })
          )}
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
