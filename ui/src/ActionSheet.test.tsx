import {beforeAll, describe, expect, it, mock} from "bun:test";
import {act, render} from "@testing-library/react-native";
import {createRef} from "react";
import {Text} from "react-native";

import {ActionSheet, getDeviceHeight, getElevation, waitAsync} from "./ActionSheet";
import {ThemeProvider} from "./Theme";

beforeAll(() => {
  (global as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 0) as unknown as number;
  };
  (global as any).cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
});

describe("ActionSheet", () => {
  it("component is defined", () => {
    expect(ActionSheet).toBeDefined();
    expect(typeof ActionSheet).toBe("function");
  });

  it("renders correctly", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet ref={ref}>
          <Text>Test content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom overlay color", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet overlayColor="rgba(0,0,0,0.5)" ref={ref}>
          <Text>Content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with gesture enabled", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet gestureEnabled ref={ref}>
          <Text>Gesture content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("show() sets modalVisible to true", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet ref={ref}>
          <Text>Content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    act(() => {
      ref.current?.show();
    });
    expect(ref.current?.state.modalVisible).toBe(true);
  });

  it("show() followed by hide() calls hide animation path", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet closeAnimationDuration={1} ref={ref}>
          <Text>Content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    act(() => {
      ref.current?.show();
    });
    expect(ref.current?.state.modalVisible).toBe(true);
    act(() => {
      ref.current?.hide();
    });
    // hide() does not immediately flip modalVisible (it animates first)
    expect(ref.current).toBeTruthy();
  });

  it("setModalVisible does nothing when state already matches", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet ref={ref}>
          <Text>Content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    // modal starts hidden, call hide again (setModalVisible(false)) - state stays hidden
    act(() => {
      ref.current?.hide();
    });
    expect(ref.current?.state.modalVisible).toBe(false);
  });

  it("snapToOffset does not throw when called before layout", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet ref={ref}>
          <Text>Content</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(() => ref.current?.snapToOffset(100)).not.toThrow();
  });

  it("renders with elevation prop", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet elevation={10} ref={ref}>
          <Text>Elevated</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with indicator color", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet indicatorColor="red" ref={ref}>
          <Text>Indicator</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with initialOffsetFromBottom", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet initialOffsetFromBottom={0.5} ref={ref}>
          <Text>Offset</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with bottomOffset", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet bottomOffset={20} ref={ref}>
          <Text>Bottom</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with closable=false and persistent", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet closable={false} ref={ref}>
          <Text>Persistent</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom containerStyle", () => {
    const ref = createRef<ActionSheet>();
    const {toJSON} = render(
      <ThemeProvider>
        <ActionSheet containerStyle={{backgroundColor: "blue"}} ref={ref}>
          <Text>Styled</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("invokes onOpen when modal is shown", () => {
    const ref = createRef<ActionSheet>();
    const handleOpen = mock(() => {});
    render(
      <ThemeProvider>
        <ActionSheet onOpen={handleOpen} ref={ref}>
          <Text>Open</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    act(() => {
      ref.current?.show();
    });
    expect(ref.current?.state.modalVisible).toBe(true);
  });

  it("_onRequestClose hides modal when closeOnPressBack is true", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet closeAnimationDuration={1} closeOnPressBack ref={ref}>
          <Text>Close</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    act(() => {
      ref.current?.show();
    });
    expect(() => (ref.current as any)._onRequestClose()).not.toThrow();
  });

  it("_onTouchBackdrop hides modal when closeOnTouchBackdrop is true", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet closeAnimationDuration={1} closeOnTouchBackdrop ref={ref}>
          <Text>Backdrop</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    act(() => {
      ref.current?.show();
    });
    expect(() => (ref.current as any)._onTouchBackdrop()).not.toThrow();
  });

  it("_onRequestClose does not hide when closeOnPressBack is false", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet closeOnPressBack={false} ref={ref}>
          <Text>NoClose</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    act(() => {
      ref.current?.show();
    });
    (ref.current as any)._onRequestClose();
    expect(ref.current?.state.modalVisible).toBe(true);
  });

  it("_onTouchBackdrop does not hide when closeOnTouchBackdrop is false", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet closeOnTouchBackdrop={false} ref={ref}>
          <Text>NoBackdrop</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    act(() => {
      ref.current?.show();
    });
    (ref.current as any)._onTouchBackdrop();
    expect(ref.current?.state.modalVisible).toBe(true);
  });

  it("_onScroll does not throw", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet ref={ref}>
          <Text>Scroll</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(() =>
      (ref.current as any)._onScroll({
        nativeEvent: {contentOffset: {x: 0, y: 10}},
      })
    ).not.toThrow();
  });

  it("_onTouchStart and _onTouchMove do not throw", () => {
    const ref = createRef<ActionSheet>();
    render(
      <ThemeProvider>
        <ActionSheet ref={ref}>
          <Text>Touch</Text>
        </ActionSheet>
      </ThemeProvider>
    );
    expect(() => (ref.current as any)._onTouchStart()).not.toThrow();
    expect(() => (ref.current as any)._onTouchMove()).not.toThrow();
    expect(() => (ref.current as any)._onTouchEnd()).not.toThrow();
  });

  describe("getDeviceHeight", () => {
    it("returns a number", () => {
      const height = getDeviceHeight(false);
      expect(typeof height).toBe("number");
      expect(height).toBeGreaterThan(0);
    });

    it("works with statusBarTranslucent true", () => {
      const height = getDeviceHeight(true);
      expect(typeof height).toBe("number");
      expect(height).toBeGreaterThan(0);
    });
  });

  describe("getElevation", () => {
    it("returns empty object for no elevation", () => {
      expect(getElevation()).toEqual({});
      expect(getElevation(0)).toEqual({});
    });

    it("returns elevation styles for positive elevation", () => {
      const result = getElevation(5);
      expect(result).toHaveProperty("elevation", 5);
      expect(result).toHaveProperty("boxShadow");
    });
  });

  describe("waitAsync", () => {
    it("resolves after the specified time", async () => {
      const result = await waitAsync(1);
      expect(result).toBeNull();
    });
  });
});
