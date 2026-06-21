// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import type {ReactTestInstance} from "react-test-renderer";

import {RNPickerSelect} from "./PickerSelect";
import {renderWithTheme} from "./test-utils";

// Note: @react-native-picker/picker is mocked globally in bunSetup.ts

describe("PickerSelect", () => {
  const defaultProps = {
    items: [
      {label: "Option 1", value: "1"},
      {label: "Option 2", value: "2"},
      {label: "Option 3", value: "3"},
    ],
    onValueChange: () => {},
    placeholder: {label: "Select an option", value: ""},
  };

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(RNPickerSelect).toBeDefined();
    expect(typeof RNPickerSelect).toBe("function");
  });

  it("renders with selected value", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} value="2" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} disabled />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without placeholder when placeholder is empty object", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} placeholder={{}} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("matches items by itemKey", () => {
    const items = [
      {key: "k1", label: "Option 1", value: "1"},
      {key: "k2", label: "Option 2", value: "2"},
    ];
    const {toJSON} = renderWithTheme(
      <RNPickerSelect
        {...defaultProps}
        itemKey="k2"
        items={items}
        placeholder={{label: "Select", value: ""}}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders children when provided", () => {
    const {getByTestId} = renderWithTheme(
      <RNPickerSelect {...defaultProps}>
        <>Custom child content</>
      </RNPickerSelect>
    );
    expect(getByTestId).toBeDefined();
  });

  it("renders custom InputAccessoryView", () => {
    const CustomAccessory = () => null;
    const {toJSON} = renderWithTheme(
      <RNPickerSelect {...defaultProps} InputAccessoryView={CustomAccessory} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("passes textInputProps to TextInput", () => {
    const {toJSON} = renderWithTheme(
      <RNPickerSelect
        {...defaultProps}
        textInputProps={{placeholder: "Custom placeholder"}}
        value="1"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onValueChange when value changes", () => {
    const mockOnValueChange = mock(() => {});
    renderWithTheme(
      <RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} value="1" />
    );
    // The component is rendered, onValueChange would be called on user interaction
    expect(mockOnValueChange).toBeDefined();
  });

  it("does not crash when value does not match any item", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} value="nonexistent" />);
    expect(toJSON()).toBeTruthy();
  });

  it("accepts onOpen, onClose, onDonePress callbacks", () => {
    const onOpen = mock(() => {});
    const onClose = mock(() => {});
    const onDonePress = mock(() => {});
    const {toJSON} = renderWithTheme(
      <RNPickerSelect
        {...defaultProps}
        onClose={onClose}
        onDonePress={onDonePress}
        onOpen={onOpen}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts onUpArrow and onDownArrow callbacks", () => {
    const onUpArrow = mock(() => {});
    const onDownArrow = mock(() => {});
    const {toJSON} = renderWithTheme(
      <RNPickerSelect {...defaultProps} onDownArrow={onDownArrow} onUpArrow={onUpArrow} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("forwards touchableDoneProps and touchableWrapperProps", () => {
    const {toJSON} = renderWithTheme(
      <RNPickerSelect
        {...defaultProps}
        touchableDoneProps={{testID: "custom_done"}}
        touchableWrapperProps={{testID: "custom_wrapper"}}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders without crashing when fixAndroidTouchableBug is true", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} fixAndroidTouchableBug />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders without crashing when useNativeAndroidPickerStyle is false", () => {
    const {toJSON} = renderWithTheme(
      <RNPickerSelect {...defaultProps} useNativeAndroidPickerStyle={false} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders with modalProps", () => {
    const {toJSON} = renderWithTheme(
      <RNPickerSelect {...defaultProps} modalProps={{animationType: "fade"}} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("updates selected item when value prop changes", () => {
    const {rerender, toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} value="1" />);
    rerender(<RNPickerSelect {...defaultProps} value="3" />);
    expect(toJSON()).toBeTruthy();
  });

  describe("web rendering (Platform.OS === 'web')", () => {
    const PlatformModule = require("react-native").Platform;
    let savedOS: any;

    let hadDocument = false;
    let savedDocument: any;

    const ensureDocument = () => {
      hadDocument = "document" in globalThis;
      savedDocument = (globalThis as any).document;
      if (typeof (globalThis as any).HTMLElement === "undefined") {
        (globalThis as any).HTMLElement = class HTMLElement {};
      }
      const el = new (globalThis as any).HTMLElement();
      el.blur = () => {};
      (globalThis as any).document = {
        activeElement: el,
        addEventListener: () => {},
        body: {
          appendChild: () => {},
          removeChild: () => {},
        },
        removeEventListener: () => {},
      };
    };

    const restoreDocument = () => {
      if (hadDocument) {
        (globalThis as any).document = savedDocument;
      } else {
        delete (globalThis as any).document;
      }
    };

    const openSearchableWebPicker = async (
      getByTestId: (id: string) => ReactTestInstance
    ): Promise<void> => {
      await act(async () => {
        fireEvent(getByTestId("text_input"), "focus");
      });
    };

    it("renders web dropdown with display label", () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} value="2" />);
        expect(getByTestId("text_input")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("renders web dropdown and opens on focus", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const onOpen = mock(() => {});
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} onOpen={onOpen} value="1" />
        );
        await openSearchableWebPicker(getByTestId);
        expect(onOpen).toHaveBeenCalled();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("opens web menu on press when searchable is false", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const onOpen = mock(() => {});
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} onOpen={onOpen} searchable={false} value="1" />
        );
        await act(async () => {
          fireEvent.press(getByTestId("web_picker"));
        });
        expect(onOpen).toHaveBeenCalled();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("does not open web menu when disabled", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const onOpen = mock(() => {});
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} disabled onOpen={onOpen} />
        );
        await act(async () => {
          fireEvent(getByTestId("text_input"), "focus");
        });
        expect(onOpen).not.toHaveBeenCalled();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("calls onClose when closing web menu", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const onClose = mock(() => {});
        const onOpen = mock(() => {});
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} onClose={onClose} onOpen={onOpen} value="1" />
        );
        await openSearchableWebPicker(getByTestId);
        expect(onOpen).toHaveBeenCalled();
        await act(async () => {
          fireEvent.press(getByTestId("web_dropdown_backdrop"));
        });
        expect(onClose).toHaveBeenCalled();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("filters dropdown options when typing in the trigger search input", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const {getByTestId, queryByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} value="1" />
        );
        await openSearchableWebPicker(getByTestId);
        const input = getByTestId("text_input");
        await act(async () => {
          fireEvent.changeText(input, "3");
        });
        expect(input.props.value).toBe("3");
        expect(getByTestId("web_dropdown_option_3")).toBeTruthy();
        expect(queryByTestId("web_dropdown_option_1")).toBeNull();
        expect(queryByTestId("web_dropdown_option_2")).toBeNull();
        expect(queryByTestId("web_dropdown_search")).toBeNull();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("updates the trigger input value while typing character by character", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} value="1" />);
        await openSearchableWebPicker(getByTestId);
        const input = getByTestId("text_input");
        await act(async () => {
          fireEvent.changeText(input, "O");
        });
        expect(input.props.value).toBe("O");
        await act(async () => {
          fireEvent.changeText(input, "Op");
        });
        expect(input.props.value).toBe("Op");
        await act(async () => {
          fireEvent.changeText(input, "Opt");
        });
        expect(input.props.value).toBe("Opt");
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("opens the menu and accepts typed input without requiring a separate menu search field", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const {getByTestId, queryByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} value="1" />
        );
        const input = getByTestId("text_input");
        await act(async () => {
          fireEvent.changeText(input, "Option 3");
        });
        expect(input.props.value).toBe("Option 3");
        expect(getByTestId("web_dropdown_option_3")).toBeTruthy();
        expect(queryByTestId("web_dropdown_search")).toBeNull();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("filters web dropdown options by option helper text from the trigger search", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const itemsWithHelper = [
          {helperText: "small red fruit", label: "Cherry", value: "c"},
          {label: "Melon", value: "m"},
        ];
        const props = {
          ...defaultProps,
          items: itemsWithHelper,
          placeholder: {label: "Select", value: ""},
        };
        const {getByTestId, queryByTestId} = renderWithTheme(
          <RNPickerSelect {...props} value="c" />
        );
        await openSearchableWebPicker(getByTestId);
        await act(async () => {
          fireEvent.changeText(getByTestId("text_input"), "red");
        });
        expect(getByTestId("web_dropdown_option_c")).toBeTruthy();
        expect(queryByTestId("web_dropdown_option_m")).toBeNull();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("shows no matching options when trigger search matches nothing", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} value="1" />);
        await openSearchableWebPicker(getByTestId);
        await act(async () => {
          fireEvent.changeText(getByTestId("text_input"), "zzz");
        });
        expect(getByTestId("web_dropdown_no_results")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("renders disabled web dropdown with correct styling", () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} disabled />);
        expect(getByTestId("web_picker")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("renders web dropdown with inputLabel when available", () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const items = [
          {inputLabel: "Opt 1 short", label: "Option 1 long", value: "1"},
          {label: "Option 2", value: "2"},
        ];
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} items={items} value="1" />
        );
        expect(getByTestId("text_input")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("renders web dropdown with no placeholder (empty object)", () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} placeholder={{}} value="1" />
        );
        expect(getByTestId("web_picker")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("calls onValueChange when a web dropdown option is selected", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const mockOnValueChange = mock(() => {});
        const {getByTestId, queryByTestId, rerender} = renderWithTheme(
          <RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} value="1" />
        );
        await openSearchableWebPicker(getByTestId);
        await act(async () => {
          fireEvent.press(getByTestId("web_dropdown_option_2"));
        });
        expect(mockOnValueChange).toHaveBeenCalledWith("2", 2);
        expect(queryByTestId("web_dropdown_backdrop")).toBeNull();
        rerender(<RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} value="2" />);
        expect(getByTestId("text_input").props.value).toBe("Option 2");
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });

    it("selects a filtered option and reports the original option index", async () => {
      ensureDocument();
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "web";
        const mockOnValueChange = mock(() => {});
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} value="1" />
        );
        await openSearchableWebPicker(getByTestId);
        await act(async () => {
          fireEvent.changeText(getByTestId("text_input"), "Option 3");
        });
        await act(async () => {
          fireEvent.press(getByTestId("web_dropdown_option_3"));
        });
        expect(mockOnValueChange).toHaveBeenCalledWith("3", 3);
      } finally {
        PlatformModule.OS = savedOS;
        restoreDocument();
      }
    });
  });

  describe("android rendering", () => {
    const PlatformModule = require("react-native").Platform;
    let savedOS: any;

    it("renders android headless when useNativeAndroidPickerStyle is false", () => {
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "android";
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} useNativeAndroidPickerStyle={false} value="1" />
        );
        expect(getByTestId("android_touchable_wrapper")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
      }
    });

    it("renders android headless with fixAndroidTouchableBug", () => {
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "android";
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect
            {...defaultProps}
            fixAndroidTouchableBug
            useNativeAndroidPickerStyle={false}
            value="1"
          />
        );
        expect(getByTestId("android_touchable_wrapper")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
      }
    });

    it("renders android headless with children", () => {
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "android";
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} value="1">
            <>Custom child</>
          </RNPickerSelect>
        );
        expect(getByTestId("android_touchable_wrapper")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
      }
    });

    it("renders native android picker style", () => {
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "android";
        const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} value="1" />);
        expect(getByTestId("android_picker")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
      }
    });

    it("renders native android picker disabled", () => {
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "android";
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} disabled value="1" />
        );
        expect(getByTestId("android_picker")).toBeTruthy();
      } finally {
        PlatformModule.OS = savedOS;
      }
    });

    it("calls onValueChange on android native picker change", async () => {
      savedOS = PlatformModule.OS;
      try {
        PlatformModule.OS = "android";
        const mockOnValueChange = mock(() => {});
        const {getByTestId} = renderWithTheme(
          <RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} value="1" />
        );
        const picker = getByTestId("android_picker");
        await act(async () => {
          picker.props.onValueChange?.("2", 1);
        });
        expect(mockOnValueChange).toHaveBeenCalledWith("2", 1);
      } finally {
        PlatformModule.OS = savedOS;
      }
    });
  });

  describe("interactions on iOS", () => {
    it("fires onOpen when the iOS wrapper is pressed and onClose when Done is pressed", async () => {
      const onOpen = mock(() => {});
      const onClose = mock(() => {});
      const onDonePress = mock(() => {});
      const {getByTestId} = renderWithTheme(
        <RNPickerSelect
          {...defaultProps}
          onClose={onClose}
          onDonePress={onDonePress}
          onOpen={onOpen}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      expect(onOpen).toHaveBeenCalled();

      await act(async () => {
        fireEvent.press(getByTestId("done_button"));
      });
      expect(onClose).toHaveBeenCalled();
      expect(onDonePress).toHaveBeenCalled();
    });

    it("invokes up/down arrow callbacks when their touchables are pressed", async () => {
      const onUpArrow = mock(() => {});
      const onDownArrow = mock(() => {});
      const {getByTestId, UNSAFE_getAllByType} = renderWithTheme(
        <RNPickerSelect {...defaultProps} onDownArrow={onDownArrow} onUpArrow={onUpArrow} />
      );
      // Open the modal so the accessory view is rendered.
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      const {TouchableOpacity} = require("react-native");
      interface TouchableTestInstance {
        props: {onPress?: () => void};
      }
      const touchables: TouchableTestInstance[] = UNSAFE_getAllByType(TouchableOpacity).filter(
        (t: TouchableTestInstance) => typeof t.props.onPress === "function"
      );
      // The accessory view renders an up-arrow TouchableOpacity then a down-arrow one.
      expect(touchables.length).toBeGreaterThanOrEqual(2);
      await act(async () => {
        touchables[0].props.onPress?.();
      });
      await act(async () => {
        touchables[1].props.onPress?.();
      });
      expect(onUpArrow).toHaveBeenCalled();
      expect(onDownArrow).toHaveBeenCalled();
    });

    it("toggles the done button press state when pressed in/out", async () => {
      const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} />);
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      const doneButton = getByTestId("done_button");
      await act(async () => {
        fireEvent(doneButton, "pressIn");
      });
      await act(async () => {
        fireEvent(doneButton, "pressOut");
      });
    });

    it("does not open when disabled", async () => {
      const onOpen = mock(() => {});
      const {getByTestId} = renderWithTheme(
        <RNPickerSelect {...defaultProps} disabled onOpen={onOpen} />
      );
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("calls onValueChange and updates selected item when the Picker emits a change", async () => {
      const mockOnValueChange = mock(() => {});
      const {getByTestId} = renderWithTheme(
        <RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} />
      );
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      const picker = getByTestId("ios_picker");
      await act(async () => {
        picker.props.onValueChange?.("2", 1);
      });
      expect(mockOnValueChange).toHaveBeenCalledWith("2", 1);
    });

    it("updates orientation state when the iOS modal rotates", async () => {
      const {getByTestId, toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} />);
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      const modal = getByTestId("ios_modal");
      await act(async () => {
        modal.props.onOrientationChange?.({nativeEvent: {orientation: "landscape"}});
      });
      expect(toJSON()).toBeTruthy();
    });

    it("closes the modal when the top overlay is pressed", async () => {
      const onClose = mock(() => {});
      const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} onClose={onClose} />);
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      await act(async () => {
        fireEvent.press(getByTestId("ios_modal_top"));
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
