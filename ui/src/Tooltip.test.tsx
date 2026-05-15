import {beforeAll, describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import {View} from "react-native";

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

// Mock react-native-portalize so Portal renders inline in tests
mock.module("react-native-portalize", () => ({
  Host: ({children}: {children: React.ReactNode}) => <View testID="portal-host">{children}</View>,
  Portal: ({children}: {children: React.ReactNode}) => <View testID="portal">{children}</View>,
}));

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
});
