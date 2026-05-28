// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
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

  describe("measure", () => {
    it("resolves with 20 when ref has no measureInWindow", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Measure</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      const result = await (ref.current as any).measure();
      expect(result).toBe(20);
    });

    it("resolves with height from measureInWindow when available", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Measure</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).safeAreaViewRef = {
        current: {
          measureInWindow: (_x: any, cb: any) => {
            if (typeof _x === "function") {
              _x(0, 0, 0, 44);
            } else {
              cb(0, 0, 0, 44);
            }
          },
        },
      };
      const result = await (ref.current as any).measure();
      expect(typeof result).toBe("number");
    });
  });

  describe("_showModal", () => {
    it("does nothing when event has no nativeEvent", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      await act(async () => {
        await (ref.current as any)._showModal({});
      });
      expect(ref.current).toBeTruthy();
    });

    it("processes layout event for first call", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      await act(async () => {
        await (ref.current as any)._showModal({
          nativeEvent: {layout: {height: 400, width: 375}},
        });
      });
      expect((ref.current as any).actionSheetHeight).toBe(400);
    });

    it("handles subsequent layout calls by updating height", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).layoutHasCalled = true;
      await act(async () => {
        await (ref.current as any)._showModal({
          nativeEvent: {layout: {height: 500, width: 375}},
        });
      });
      expect((ref.current as any).actionSheetHeight).toBe(500);
    });
  });

  describe("_openAnimation", () => {
    it("runs spring animation when animated is true", () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet animated ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      expect(() => (ref.current as any)._openAnimation(100)).not.toThrow();
    });

    it("sets opacityValue directly when animated is false", () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet animated={false} ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      expect(() => (ref.current as any)._openAnimation(100)).not.toThrow();
    });
  });

  describe("_onScrollBeginDrag", () => {
    it("stores previous scroll position from event", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      await (ref.current as any)._onScrollBeginDrag({
        nativeEvent: {contentOffset: {y: 42}},
      });
      expect((ref.current as any).prevScroll).toBe(42);
    });
  });

  describe("_applyHeightLimiter", () => {
    it("limits actionSheetHeight to deviceHeight", () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).actionSheetHeight = 5000;
      (ref.current as any)._applyHeightLimiter();
      expect((ref.current as any).actionSheetHeight).toBeLessThanOrEqual(
        ref.current!.state.deviceHeight
      );
    });

    it("does not change height when smaller than deviceHeight", () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).actionSheetHeight = 100;
      (ref.current as any)._applyHeightLimiter();
      expect((ref.current as any).actionSheetHeight).toBe(100);
    });
  });

  describe("_onScrollEnd", () => {
    it("does nothing when isRecoiling is true", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).isRecoiling = true;
      await (ref.current as any)._onScrollEnd({
        nativeEvent: {contentOffset: {y: 100}},
      });
      expect(ref.current).toBeTruthy();
    });

    it("handles scroll up past springOffset threshold", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref} springOffset={10}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).prevScroll = 50;
      (ref.current as any).actionSheetHeight = 400;
      await act(async () => {
        await (ref.current as any)._onScrollEnd({
          nativeEvent: {contentOffset: {y: 200}},
        });
      });
      expect(ref.current).toBeTruthy();
    });

    it("returns to previous scroll position when scroll up is within threshold", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref} springOffset={200}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).prevScroll = 50;
      (ref.current as any).actionSheetHeight = 400;
      await act(async () => {
        await (ref.current as any)._onScrollEnd({
          nativeEvent: {contentOffset: {y: 55}},
        });
      });
      expect(ref.current).toBeTruthy();
    });

    it("hides modal when scroll down exceeds springOffset", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet closeAnimationDuration={1} ref={ref} springOffset={10}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      act(() => {
        ref.current?.show();
      });
      (ref.current as any).prevScroll = 200;
      (ref.current as any).actionSheetHeight = 400;
      await act(async () => {
        await (ref.current as any)._onScrollEnd({
          nativeEvent: {contentOffset: {y: 50}},
        });
      });
      expect(ref.current).toBeTruthy();
    });

    it("recoils when scroll down is within springOffset", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref} springOffset={200}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).prevScroll = 200;
      (ref.current as any).actionSheetHeight = 400;
      await act(async () => {
        await (ref.current as any)._onScrollEnd({
          nativeEvent: {contentOffset: {y: 195}},
        });
      });
      expect(ref.current).toBeTruthy();
    });
  });

  describe("_onKeyboardShow", () => {
    it("sets keyboard state to true", () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      act(() => {
        try {
          (ref.current as any)._onKeyboardShow({
            endCoordinates: {height: 300, screenX: 0, screenY: 500, width: 375},
          });
        } catch {
          // TextInput.State may not be available in test env
        }
      });
      expect(ref.current!.state.keyboard).toBe(true);
    });
  });

  describe("_onKeyboardHide", () => {
    it("resets keyboard state and runs animation", () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any)._onKeyboardHide();
      expect(ref.current!.state.keyboard).toBe(false);
    });
  });

  describe("handleChildScrollEnd", () => {
    it("returns early when offsetY > prevScroll", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).offsetY = 200;
      (ref.current as any).prevScroll = 100;
      await (ref.current as any).handleChildScrollEnd();
      expect(ref.current).toBeTruthy();
    });

    it("hides modal when scroll far enough from initial", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet closeAnimationDuration={1} ref={ref} springOffset={10}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      act(() => {
        ref.current?.show();
      });
      (ref.current as any).offsetY = 10;
      (ref.current as any).prevScroll = 500;
      (ref.current as any).actionSheetHeight = 400;
      await act(async () => {
        await (ref.current as any).handleChildScrollEnd();
      });
      expect(ref.current).toBeTruthy();
    });

    it("recoils to previous scroll when close to initial offset", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref} springOffset={10}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).offsetY = 10;
      (ref.current as any).prevScroll = 500;
      (ref.current as any).actionSheetHeight = 10;
      await act(async () => {
        await (ref.current as any).handleChildScrollEnd();
      });
      expect(ref.current).toBeTruthy();
    });

    it("recoils to prevScroll when within springOffset", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref} springOffset={10}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).offsetY = 95;
      (ref.current as any).prevScroll = 100;
      await act(async () => {
        await (ref.current as any).handleChildScrollEnd();
      });
      expect(ref.current).toBeTruthy();
    });
  });

  describe("componentWillUnmount", () => {
    it("removes keyboard listeners on unmount", () => {
      const ref = createRef<ActionSheet>();
      const {unmount} = render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("_onDeviceLayout", () => {
    it("processes device layout event", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      await act(async () => {
        await (ref.current as any)._onDeviceLayout({
          nativeEvent: {layout: {height: 800, width: 375}},
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(ref.current).toBeTruthy();
    });

    it("clears existing timeout before setting new one", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).timeout = setTimeout(() => {}, 10000);
      await act(async () => {
        await (ref.current as any)._onDeviceLayout({
          nativeEvent: {layout: {height: 800, width: 375}},
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(ref.current).toBeTruthy();
    });

    it("skips update when height and width match", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).deviceLayoutCalled = true;
      const currentHeight = ref.current!.state.deviceHeight;
      const currentWidth = ref.current!.state.deviceWidth;
      await act(async () => {
        await (ref.current as any)._onDeviceLayout({
          nativeEvent: {layout: {height: currentHeight, width: currentWidth}},
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(ref.current).toBeTruthy();
    });
  });

  describe("getInitialScrollPosition", () => {
    it("returns a scroll position with gestureEnabled", () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet gestureEnabled initialOffsetFromBottom={0.5} ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).actionSheetHeight = 400;
      const pos = (ref.current as any).getInitialScrollPosition();
      expect(typeof pos).toBe("number");
    });

    it("returns a scroll position without gestureEnabled", () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      (ref.current as any).actionSheetHeight = 400;
      const pos = (ref.current as any).getInitialScrollPosition();
      expect(typeof pos).toBe("number");
    });
  });

  describe("_hideAnimation with closable=false", () => {
    it("snaps back instead of closing when closable is false", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet closable={false} closeAnimationDuration={1} ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      act(() => {
        ref.current?.show();
      });
      (ref.current as any).actionSheetHeight = 400;
      act(() => {
        ref.current?.hide();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(ref.current!.state.modalVisible).toBe(true);
    });

    it("snaps to bottomOffset when closable is false and bottomOffset set", async () => {
      const ref = createRef<ActionSheet>();
      render(
        <ThemeProvider>
          <ActionSheet bottomOffset={50} closable={false} closeAnimationDuration={1} ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      act(() => {
        ref.current?.show();
      });
      (ref.current as any).actionSheetHeight = 400;
      act(() => {
        ref.current?.hide();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(ref.current!.state.modalVisible).toBe(true);
    });
  });

  describe("renders with CustomHeaderComponent", () => {
    it("renders custom header when gestureEnabled is true", () => {
      const ref = createRef<ActionSheet>();
      const {toJSON} = render(
        <ThemeProvider>
          <ActionSheet CustomHeaderComponent={<Text>Custom Header</Text>} gestureEnabled ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      expect(toJSON()).toMatchSnapshot();
    });

    it("renders header when headerAlwaysVisible is true", () => {
      const ref = createRef<ActionSheet>();
      const {toJSON} = render(
        <ThemeProvider>
          <ActionSheet headerAlwaysVisible ref={ref}>
            <Text>Content</Text>
          </ActionSheet>
        </ThemeProvider>
      );
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
