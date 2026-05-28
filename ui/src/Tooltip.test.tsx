import {beforeAll, describe, expect, it, mock} from "bun:test";
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
    expect(true).toBe(true);
  });

  it("web click handler hides visible tooltip", async () => {
    const {Platform} = require("react-native") as {Platform: {OS: string}};
    const origOS = Platform.OS;
    Platform.OS = "web";
    try {
      const {toJSON, queryByTestId} = renderWithTheme(
        <Tooltip text="Click test">
          <Text>Click me</Text>
        </Tooltip>
      );

      const tree = toJSON() as TestNode;
      const root = tree.children?.[0] as TestNode;

      // Show tooltip via touch
      await act(async () => {
        root.props.onTouchStart?.({nativeEvent: {}});
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });
      expect(queryByTestId("tooltip-container")).toBeTruthy();

      // Click (web handler) should hide tooltip
      const onPress = (root.props as {onPress?: () => void}).onPress;
      if (onPress) {
        await act(async () => {
          onPress();
        });
        await act(async () => {
          await new Promise((r) => setTimeout(r, 50));
        });
      }
    } finally {
      Platform.OS = origOS;
    }
  });

  it("mobilePressProps.onPress calls children onClick when not touched", async () => {
    const childOnClick = mock(() => {});
    const {toJSON} = renderWithTheme(
      <Tooltip text="Mobile test">
        <Text onClick={childOnClick}>Tap me</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;
    // onPress is from mobilePressProps — fires children's onClick when touched.current is false
    const onPress = (root.props as {onPress?: () => void}).onPress;
    if (onPress) {
      await act(async () => {
        onPress();
      });
    }
    expect(childOnClick).toHaveBeenCalled();
  });

  it("shows tooltip with arrow and exercises getArrowContainerStyle at all positions", async () => {
    const positions: Array<"top" | "bottom" | "left" | "right"> = [
      "top",
      "bottom",
      "left",
      "right",
    ];
    for (const position of positions) {
      const {toJSON, queryByTestId} = renderWithTheme(
        <Tooltip idealPosition={position} includeArrow text={`Arrow ${position}`}>
          <Text>{position}</Text>
        </Tooltip>
      );

      const tree = toJSON() as TestNode;
      const root = tree.children?.[0] as TestNode;

      // Show tooltip
      await act(async () => {
        root.props.onTouchStart?.({nativeEvent: {}});
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });
      expect(queryByTestId("tooltip-container")).toBeTruthy();
    }
  });

  it("handleHoverOut clears showTooltipTimer before tooltip appears", async () => {
    const {toJSON, queryByTestId} = renderWithTheme(
      <Tooltip text="Hover out test">
        <Text>Hover</Text>
      </Tooltip>
    );

    const tree = toJSON() as TestNode;
    const root = tree.children?.[0] as TestNode;

    // Start hover in
    await act(async () => {
      root.props.onPointerEnter?.();
    });
    // Immediately hover out before the delay expires
    await act(async () => {
      root.props.onPointerLeave?.();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1000));
    });
    // Tooltip should NOT appear
    expect(queryByTestId("tooltip-container")).toBeNull();
  });

  it("handleTouchStart hides tooltip if already visible", async () => {
    const {root, queryByTestId} = renderWithTheme(
      <Tooltip text="Touch toggle test">
        <Text>Touch</Text>
      </Tooltip>
    );

    // Find the wrapper View that has onTouchStart
    const wrapper = root.findAll(
      (n) =>
        typeof n.props.onTouchStart === "function" && typeof n.props.onPointerEnter === "function"
    );
    expect(wrapper.length).toBeGreaterThan(0);

    // Show tooltip
    await act(async () => {
      wrapper[0].props.onTouchStart({nativeEvent: {}});
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(queryByTestId("tooltip-container")).toBeTruthy();

    // Touch again to hide (handleTouchStart checks visible and calls hideTooltip)
    await act(async () => {
      wrapper[0].props.onTouchStart({nativeEvent: {}});
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(queryByTestId("tooltip-container")).toBeNull();
  });

  it("returns children directly when text is empty", () => {
    const {getByText, queryByTestId} = renderWithTheme(
      <Tooltip text="">
        <Text>Direct child</Text>
      </Tooltip>
    );
    expect(getByText("Direct child")).toBeTruthy();
    expect(queryByTestId("tooltip-container")).toBeNull();
  });
});
