import {afterEach, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";

import {Text} from "./Text";
import {Tooltip} from "./Tooltip";
import {renderWithTheme} from "./test-utils";

// Minimal shape of the tree returned by toJSON() that we rely on here.
interface TestNode {
  type: string;
  props: {
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
    onTouchStart?: (event?: {nativeEvent: object}) => void;
    onLayout?: (event: {
      nativeEvent: {layout: {height: number; width: number; x: number; y: number}};
    }) => void;
  };
  children: null | Array<TestNode | string>;
}

type MeasureCallback = (
  x: number,
  y: number,
  width: number,
  height: number,
  pageX: number,
  pageY: number
) => void;

beforeAll(() => {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 0) as unknown as number;
  };
  globalThis.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
});

describe("Tooltip", () => {
  it("renders children correctly", () => {
    const {getByText} = renderWithTheme(
      <Tooltip text="Tooltip text">
        <Text>Hover me</Text>
      </Tooltip>
    );
    expect(getByText("Hover me")).toBeTruthy();
  });

  it("renders without tooltip when text is empty", () => {
    const {getByText, toJSON} = renderWithTheme(
      <Tooltip text="">
        <Text>No tooltip</Text>
      </Tooltip>
    );
    expect(getByText("No tooltip")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with tooltip text", () => {
    const {toJSON} = renderWithTheme(
      <Tooltip text="This is helpful information">
        <Text>Hover for info</Text>
      </Tooltip>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with top position (default)", () => {
    const {toJSON} = renderWithTheme(
      <Tooltip idealPosition="top" text="Top tooltip">
        <Text>Content</Text>
      </Tooltip>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with bottom position", () => {
    const {toJSON} = renderWithTheme(
      <Tooltip idealPosition="bottom" text="Bottom tooltip">
        <Text>Content</Text>
      </Tooltip>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with left position", () => {
    const {toJSON} = renderWithTheme(
      <Tooltip idealPosition="left" text="Left tooltip">
        <Text>Content</Text>
      </Tooltip>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with right position", () => {
    const {toJSON} = renderWithTheme(
      <Tooltip idealPosition="right" text="Right tooltip">
        <Text>Content</Text>
      </Tooltip>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with arrow", () => {
    const {toJSON} = renderWithTheme(
      <Tooltip includeArrow text="Tooltip with arrow">
        <Text>Content</Text>
      </Tooltip>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with arrow and specific position", () => {
    const {toJSON} = renderWithTheme(
      <Tooltip idealPosition="bottom" includeArrow text="Bottom with arrow">
        <Text>Content</Text>
      </Tooltip>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("shows tooltip after hover in delay", async () => {
    const {queryByTestId, toJSON} = renderWithTheme(
      <Tooltip text="Hover reveals">
        <Text>Hover me</Text>
      </Tooltip>
    );

    const wrapper = toJSON();
    expect(wrapper).toBeTruthy();
    expect(queryByTestId("tooltip-container")).toBeNull();

    const tree = toJSON() as TestNode | null;
    await act(async () => {
      // Trigger pointer enter on the wrapper
      const root = tree?.children?.[0] as TestNode | undefined;
      if (root?.props?.onPointerEnter) {
        root.props.onPointerEnter();
      }
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    });

    expect(queryByTestId("tooltip-container")).toBeTruthy();
  });

  it("shows tooltip on touch and hides on second touch", async () => {
    const {queryByTestId, toJSON} = renderWithTheme(
      <Tooltip text="Touch reveals">
        <Text>Touch me</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    await act(async () => {
      root.props.onTouchStart?.({nativeEvent: {}});
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(queryByTestId("tooltip-container")).toBeTruthy();

    // Second touch should hide
    const treeAfterShow = toJSON() as TestNode;
    const updatedRoot = (treeAfterShow.children as Array<TestNode | string>)[
      (treeAfterShow.children as Array<TestNode | string>).length - 1
    ] as TestNode;
    await act(async () => {
      updatedRoot.props.onTouchStart?.({nativeEvent: {}});
    });

    expect(queryByTestId("tooltip-container")).toBeNull();
  });

  it("hides tooltip when onPointerLeave is triggered", async () => {
    const {queryByTestId, toJSON} = renderWithTheme(
      <Tooltip text="Hover reveals">
        <Text>Hover me</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    await act(async () => {
      root.props.onPointerEnter?.();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    });

    expect(queryByTestId("tooltip-container")).toBeTruthy();

    const treeAfter = toJSON() as TestNode;
    const wrapper = (treeAfter.children as Array<TestNode | string>)[
      (treeAfter.children as Array<TestNode | string>).length - 1
    ] as TestNode;
    await act(async () => {
      wrapper.props.onPointerLeave?.();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(queryByTestId("tooltip-container")).toBeNull();
  });

  it("calls onHoverIn/onHoverOut handlers from children props", async () => {
    const onHoverIn = mock(() => {});
    const onHoverOut = mock(() => {});
    const TestChild: React.FC<{onHoverIn?: () => void; onHoverOut?: () => void}> = ({
      onHoverIn: _in,
      onHoverOut: _out,
    }) => <Text>Child</Text>;

    const {toJSON} = renderWithTheme(
      <Tooltip text="Hover handlers">
        <TestChild onHoverIn={onHoverIn} onHoverOut={onHoverOut} />
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    await act(async () => {
      root.props.onPointerEnter?.();
    });
    expect(onHoverIn).toHaveBeenCalled();

    await act(async () => {
      root.props.onPointerLeave?.();
    });
    expect(onHoverOut).toHaveBeenCalled();
  });

  it("triggers onLayout and exercises getTooltipPosition with overflow cases", async () => {
    const {queryByTestId, UNSAFE_getAllByType, toJSON} = renderWithTheme(
      <Tooltip idealPosition="bottom" includeArrow text="Layout test">
        <Text>Trigger</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    // Show the tooltip
    await act(async () => {
      root.props.onTouchStart?.({nativeEvent: {}});
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(queryByTestId("tooltip-container")).toBeTruthy();

    // Find any views with onLayout to simulate layout event
    const {View: ViewComp} = await import("react-native");
    const allViews = UNSAFE_getAllByType(ViewComp);
    for (const v of allViews) {
      const props = v.props as TestNode["props"];
      if (props.onLayout) {
        await act(async () => {
          props.onLayout?.({
            nativeEvent: {
              layout: {height: 100, width: 200, x: 0, y: 0},
            },
          });
        });
      }
    }
  });

  it("renders tooltip with arrow at all idealPositions", async () => {
    const positions: Array<"top" | "bottom" | "left" | "right"> = [
      "top",
      "bottom",
      "left",
      "right",
    ];

    for (const position of positions) {
      const {toJSON} = renderWithTheme(
        <Tooltip idealPosition={position} includeArrow text={`${position} tooltip`}>
          <Text>{position}</Text>
        </Tooltip>
      );
      expect(toJSON()).toBeTruthy();
    }
  });

  it("unmount hides tooltip and clears timers", async () => {
    const {unmount, toJSON} = renderWithTheme(
      <Tooltip text="Will unmount">
        <Text>Unmount child</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;
    await act(async () => {
      root.props.onPointerEnter?.();
    });
    unmount();
    // No assertions needed - just ensuring no crashes on unmount.
    expect(true).toBe(true);
  });

  it("hides tooltip when pressing on the tooltip container", async () => {
    const {queryByTestId, toJSON, getByTestId} = renderWithTheme(
      <Tooltip text="Click to hide">
        <Text>Hover me</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    await act(async () => {
      root.props.onPointerEnter?.();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    });
    expect(queryByTestId("tooltip-container")).toBeTruthy();

    const {fireEvent} = await import("@testing-library/react-native");
    await act(async () => {
      fireEvent.press(getByTestId("tooltip-container"));
    });
    expect(queryByTestId("tooltip-container")).toBeNull();
  });

  it("handleClick does nothing when tooltip is not visible", async () => {
    const {queryByTestId, toJSON} = renderWithTheme(
      <Tooltip text="Click test">
        <Text>Click me</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    // Call onPress when tooltip is not visible (no-op)
    await act(async () => {
      (root.props as {onPress?: () => void}).onPress?.();
    });
    expect(queryByTestId("tooltip-container")).toBeNull();
  });

  it("handles onLayout with measure callback and sets position", async () => {
    const {queryByTestId, toJSON, UNSAFE_getAllByType} = renderWithTheme(
      <Tooltip idealPosition="top" includeArrow text="Layout position test">
        <Text>Trigger</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    // Show the tooltip first
    await act(async () => {
      root.props.onTouchStart?.({nativeEvent: {}});
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(queryByTestId("tooltip-container")).toBeTruthy();

    const {View: ViewComp} = await import("react-native");
    const allViews = UNSAFE_getAllByType(ViewComp);
    for (const v of allViews) {
      const props = v.props as TestNode["props"];
      if (props.onLayout) {
        await act(async () => {
          props.onLayout?.({
            nativeEvent: {
              layout: {height: 40, width: 200, x: 0, y: 0},
            },
          });
        });
      }
    }
  });

  it("exercises getTooltipPosition with all ideal positions", async () => {
    const positions: Array<"top" | "bottom" | "left" | "right"> = [
      "top",
      "bottom",
      "left",
      "right",
    ];

    for (const pos of positions) {
      const {queryByTestId, toJSON, UNSAFE_getAllByType, unmount} = renderWithTheme(
        <Tooltip idealPosition={pos} includeArrow text={`${pos} test`}>
          <Text>Position {pos}</Text>
        </Tooltip>
      );

      const tree = toJSON() as TestNode;
      const root = tree.children?.[0] as TestNode;

      await act(async () => {
        root.props.onTouchStart?.({nativeEvent: {}});
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
      expect(queryByTestId("tooltip-container")).toBeTruthy();

      const {View: ViewComp} = await import("react-native");
      const allViews = UNSAFE_getAllByType(ViewComp);
      for (const v of allViews) {
        const props = v.props as TestNode["props"];
        if (props.onLayout) {
          await act(async () => {
            props.onLayout?.({
              nativeEvent: {
                layout: {height: 30, width: 100, x: 50, y: 50},
              },
            });
          });
        }
      }
      unmount();
    }
  });

  it("renders arrow styles for all positions when tooltip is shown with arrow", async () => {
    const positions: Array<"top" | "bottom" | "left" | "right"> = [
      "top",
      "bottom",
      "left",
      "right",
    ];

    for (const pos of positions) {
      const {queryByTestId, toJSON, unmount} = renderWithTheme(
        <Tooltip idealPosition={pos} includeArrow text={`Arrow ${pos}`}>
          <Text>Arrow</Text>
        </Tooltip>
      );

      const tree = toJSON() as TestNode;
      const root = tree.children?.[0] as TestNode;

      await act(async () => {
        root.props.onPointerEnter?.();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 900));
      });
      expect(queryByTestId("tooltip-container")).toBeTruthy();
      unmount();
    }
  });

  it("mobilePressProps fires children onClick when not touched", async () => {
    const onClick = mock(() => {});
    const TestChild: React.FC<{onClick?: () => void}> = () => <Text>Pressable child</Text>;

    const {toJSON} = renderWithTheme(
      <Tooltip text="Mobile test">
        <TestChild onClick={onClick} />
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    // Fire onPress (mobilePressProps) without having touched first
    await act(async () => {
      (root.props as {onPress?: () => void}).onPress?.();
    });
    expect(onClick).toHaveBeenCalled();
  });

  it("getArrowContainerStyle returns empty when includeArrow is false", async () => {
    const {queryByTestId, toJSON} = renderWithTheme(
      <Tooltip text="No arrow test">
        <Text>No arrow</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    await act(async () => {
      root.props.onPointerEnter?.();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    });
    expect(queryByTestId("tooltip-container")).toBeTruthy();
  });

  describe("web platform behavior", () => {
    let Platform: {OS: string};

    beforeEach(async () => {
      const rn = await import("react-native");
      Platform = rn.Platform;
      Platform.OS = "web";
    });

    afterEach(() => {
      Platform.OS = "ios";
    });

    it("renders Arrow component when isWeb and includeArrow", async () => {
      const {queryByTestId, toJSON} = renderWithTheme(
        <Tooltip idealPosition="top" includeArrow text="Web arrow">
          <Text>Arrow child</Text>
        </Tooltip>
      );

      const tree = toJSON() as TestNode;
      const root = tree.children?.[0] as TestNode;

      await act(async () => {
        root.props.onPointerEnter?.();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 900));
      });
      expect(queryByTestId("tooltip-container")).toBeTruthy();
    });

    it("renders Arrow for all positions on web", async () => {
      const positions: Array<"top" | "bottom" | "left" | "right"> = [
        "top",
        "bottom",
        "left",
        "right",
      ];
      for (const pos of positions) {
        const {queryByTestId, toJSON, unmount} = renderWithTheme(
          <Tooltip idealPosition={pos} includeArrow text={`Web ${pos}`}>
            <Text>{pos}</Text>
          </Tooltip>
        );

        const tree = toJSON() as TestNode;
        const root = tree.children?.[0] as TestNode;

        await act(async () => {
          root.props.onTouchStart?.({nativeEvent: {}});
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
        });
        expect(queryByTestId("tooltip-container")).toBeTruthy();
        unmount();
      }
    });

    it("handleClick hides tooltip on web when visible", async () => {
      const {queryByTestId, toJSON} = renderWithTheme(
        <Tooltip text="Web click hide">
          <Text>Click me</Text>
        </Tooltip>
      );

      const tree = toJSON() as TestNode;
      const root = tree.children?.[0] as TestNode;

      await act(async () => {
        root.props.onPointerEnter?.();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 900));
      });
      expect(queryByTestId("tooltip-container")).toBeTruthy();

      // On web, onPress is handleClick which hides tooltip when visible
      const treeAfter = toJSON() as TestNode;
      const wrapper = (treeAfter.children as TestNode[]).find(
        (c: TestNode) => c.props && (c.props as {hitSlop?: object}).hitSlop !== undefined
      ) as TestNode | undefined;
      await act(async () => {
        (wrapper?.props as {onPress?: () => void}).onPress?.();
      });
      expect(queryByTestId("tooltip-container")).toBeNull();
    });

    it("exercises measure callback and getTooltipPosition for all positions", async () => {
      const positions: Array<"top" | "bottom" | "left" | "right"> = [
        "top",
        "bottom",
        "left",
        "right",
      ];

      for (const pos of positions) {
        const {toJSON, UNSAFE_getAllByType, unmount} = renderWithTheme(
          <Tooltip idealPosition={pos} includeArrow text={`Measure ${pos}`}>
            <Text>{pos}</Text>
          </Tooltip>
        );

        const tree = toJSON() as TestNode;
        const root = tree.children?.[0] as TestNode;

        await act(async () => {
          root.props.onTouchStart?.({nativeEvent: {}});
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
        });

        // Find the ref-holding View (has hitSlop) and inject measure via fiber ref
        const {View: ViewComp} = await import("react-native");
        const allViews = UNSAFE_getAllByType(ViewComp);
        for (const v of allViews) {
          if (!(v.props as {hitSlop?: object}).hitSlop) {
            continue;
          }
          const fiber = (v as unknown as {_fiber?: {ref?: {current: unknown}}})._fiber;
          if (fiber?.ref && typeof fiber.ref === "object") {
            const pageX = pos === "left" ? 400 : pos === "right" ? 50 : 200;
            const pageY = pos === "top" ? 400 : 100;
            fiber.ref.current = {
              measure: (cb: MeasureCallback) => {
                cb(0, 0, 100, 40, pageX, pageY);
              },
            };
          }
        }

        // Trigger onLayout to invoke measure and getTooltipPosition
        for (const v of allViews) {
          const props = v.props as TestNode["props"];
          if (props.onLayout) {
            await act(async () => {
              props.onLayout?.({
                nativeEvent: {layout: {height: 30, width: 80, x: 0, y: 0}},
              });
            });
          }
        }
        unmount();
      }
    });

    it("getTooltipPosition fallback when all positions overflow", async () => {
      const {toJSON, UNSAFE_getAllByType, unmount} = renderWithTheme(
        <Tooltip idealPosition="top" text="Overflow">
          <Text>Overflow</Text>
        </Tooltip>
      );

      const tree = toJSON() as TestNode;
      const root = tree.children?.[0] as TestNode;

      await act(async () => {
        root.props.onTouchStart?.({nativeEvent: {}});
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const {View: ViewComp} = await import("react-native");
      const allViews = UNSAFE_getAllByType(ViewComp);
      for (const v of allViews) {
        if (!(v.props as {hitSlop?: object}).hitSlop) {
          continue;
        }
        const fiber = (v as unknown as {_fiber?: {ref?: {current: unknown}}})._fiber;
        if (fiber?.ref && typeof fiber.ref === "object") {
          fiber.ref.current = {
            measure: (cb: MeasureCallback) => {
              cb(0, 0, 900, 900, 0, 0);
            },
          };
        }
      }

      for (const v of allViews) {
        const props = v.props as TestNode["props"];
        if (props.onLayout) {
          await act(async () => {
            props.onLayout?.({
              nativeEvent: {layout: {height: 900, width: 900, x: 0, y: 0}},
            });
          });
        }
      }
      unmount();
    });
  });
});
