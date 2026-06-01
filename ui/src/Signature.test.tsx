import {afterEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {Signature} from "./Signature";
import {renderWithTheme} from "./test-utils";

const createMockContext = (): Record<string, ReturnType<typeof mock>> => ({
  beginPath: mock(() => {}),
  fillRect: mock(() => {}),
  lineTo: mock(() => {}),
  moveTo: mock(() => {}),
  stroke: mock(() => {}),
});

const patchCanvasRefs = (
  container: {
    findAll: (
      predicate: (node: {type: string}) => boolean
    ) => Array<{props: Record<string, unknown>}>;
  },
  ctx: Record<string, ReturnType<typeof mock>>
): HTMLCanvasElement => {
  const canvasNodes = container.findAll((node: {type: string}) => node.type === "canvas");
  const canvasNode = canvasNodes[0];
  const canvas = {
    getContext: mock(() => ctx),
    height: 180,
    releasePointerCapture: mock(() => {}),
    setPointerCapture: mock(() => {}),
    toDataURL: mock(() => "data:image/png;base64,AAAA"),
    width: 300,
  } as unknown as HTMLCanvasElement;

  const ref = canvasNode.props.ref;
  if (typeof ref === "function") {
    ref(canvas);
  } else if (ref && typeof ref === "object" && "current" in ref) {
    (ref as {current: unknown}).current = canvas;
  }
  return canvas;
};

describe("Signature", () => {
  afterEach(() => {
    mock.restore();
  });

  it("renders correctly", () => {
    const mockOnChange = mock(() => {});
    const {toJSON} = renderWithTheme(<Signature onChange={mockOnChange} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(Signature).toBeDefined();
    expect(typeof Signature).toBe("function");
  });

  it("renders with clear button", () => {
    const mockOnChange = mock(() => {});
    const {getByText} = renderWithTheme(<Signature onChange={mockOnChange} />);
    expect(getByText("Clear")).toBeTruthy();
  });

  it("notifies the parent with an empty value when Clear is pressed", () => {
    const mockOnChange = mock(() => {});
    const {getByText} = renderWithTheme(<Signature onChange={mockOnChange} />);
    fireEvent.press(getByText("Clear"));
    expect(mockOnChange).toHaveBeenCalledWith("");
  });

  it("calls onStart when pointer down is fired on the canvas", () => {
    const mockOnChange = mock(() => {});
    const mockOnStart = mock(() => {});
    const ctx = createMockContext();
    const {UNSAFE_root} = renderWithTheme(
      <Signature onChange={mockOnChange} onStart={mockOnStart} />
    );

    patchCanvasRefs(UNSAFE_root, ctx);

    const canvasNodes = UNSAFE_root.findAll((node: {type: string}) => node.type === "canvas");
    const canvasProps = canvasNodes[0].props as Record<string, (...args: unknown[]) => void>;

    act(() => {
      canvasProps.onPointerDown({
        nativeEvent: {offsetX: 10, offsetY: 20},
        pointerId: 1,
      });
    });

    expect(mockOnStart).toHaveBeenCalledTimes(1);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
  });

  it("draws a stroke on pointerMove after pointerDown", () => {
    const mockOnChange = mock(() => {});
    const ctx = createMockContext();
    const {UNSAFE_root} = renderWithTheme(<Signature onChange={mockOnChange} />);

    patchCanvasRefs(UNSAFE_root, ctx);

    const canvasNodes = UNSAFE_root.findAll((node: {type: string}) => node.type === "canvas");
    const canvasProps = canvasNodes[0].props as Record<string, (...args: unknown[]) => void>;

    act(() => {
      canvasProps.onPointerDown({
        nativeEvent: {offsetX: 5, offsetY: 5},
        pointerId: 1,
      });
    });

    act(() => {
      canvasProps.onPointerMove({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });

    expect(ctx.lineTo).toHaveBeenCalledWith(50, 50);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("ignores pointerMove when not drawing", () => {
    const mockOnChange = mock(() => {});
    const ctx = createMockContext();
    const {UNSAFE_root} = renderWithTheme(<Signature onChange={mockOnChange} />);

    patchCanvasRefs(UNSAFE_root, ctx);

    const canvasNodes = UNSAFE_root.findAll((node: {type: string}) => node.type === "canvas");
    const canvasProps = canvasNodes[0].props as Record<string, (...args: unknown[]) => void>;

    act(() => {
      canvasProps.onPointerMove({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });

    expect(ctx.lineTo).not.toHaveBeenCalled();
  });

  it("exports the signature as a data URL on pointerUp after drawing", () => {
    const mockOnChange = mock(() => {});
    const mockOnEnd = mock(() => {});
    const ctx = createMockContext();
    const {UNSAFE_root} = renderWithTheme(<Signature onChange={mockOnChange} onEnd={mockOnEnd} />);

    const canvas = patchCanvasRefs(UNSAFE_root, ctx);

    const canvasNodes = UNSAFE_root.findAll((node: {type: string}) => node.type === "canvas");
    const canvasProps = canvasNodes[0].props as Record<string, (...args: unknown[]) => void>;

    // Start drawing
    act(() => {
      canvasProps.onPointerDown({
        nativeEvent: {offsetX: 5, offsetY: 5},
        pointerId: 1,
      });
    });

    // Move to draw
    act(() => {
      canvasProps.onPointerMove({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });

    // Lift the pointer
    act(() => {
      canvasProps.onPointerUp({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });

    expect(mockOnChange).toHaveBeenCalledWith("data:image/png;base64,AAAA");
    expect(mockOnEnd).toHaveBeenCalledTimes(1);
    expect(
      (canvas as unknown as {releasePointerCapture: ReturnType<typeof mock>}).releasePointerCapture
    ).toHaveBeenCalledWith(1);
  });

  it("does not call onChange on pointerUp if nothing was drawn", () => {
    const mockOnChange = mock(() => {});
    const ctx = createMockContext();
    const {UNSAFE_root} = renderWithTheme(<Signature onChange={mockOnChange} />);

    patchCanvasRefs(UNSAFE_root, ctx);

    const canvasNodes = UNSAFE_root.findAll((node: {type: string}) => node.type === "canvas");
    const canvasProps = canvasNodes[0].props as Record<string, (...args: unknown[]) => void>;

    // pointerDown without any move (no drawing)
    act(() => {
      canvasProps.onPointerDown({
        nativeEvent: {offsetX: 5, offsetY: 5},
        pointerId: 1,
      });
    });

    act(() => {
      canvasProps.onPointerUp({
        nativeEvent: {offsetX: 5, offsetY: 5},
        pointerId: 1,
      });
    });

    // onChange should not be called with a data URL (no strokes were made)
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("ignores pointerUp when not drawing", () => {
    const mockOnChange = mock(() => {});
    const mockOnEnd = mock(() => {});
    const ctx = createMockContext();
    const {UNSAFE_root} = renderWithTheme(<Signature onChange={mockOnChange} onEnd={mockOnEnd} />);

    patchCanvasRefs(UNSAFE_root, ctx);

    const canvasNodes = UNSAFE_root.findAll((node: {type: string}) => node.type === "canvas");
    const canvasProps = canvasNodes[0].props as Record<string, (...args: unknown[]) => void>;

    act(() => {
      canvasProps.onPointerUp({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });

    expect(mockOnEnd).not.toHaveBeenCalled();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("handles pointerLeave the same as pointerUp", () => {
    const mockOnChange = mock(() => {});
    const mockOnEnd = mock(() => {});
    const ctx = createMockContext();
    const {UNSAFE_root} = renderWithTheme(<Signature onChange={mockOnChange} onEnd={mockOnEnd} />);

    patchCanvasRefs(UNSAFE_root, ctx);

    const canvasNodes = UNSAFE_root.findAll((node: {type: string}) => node.type === "canvas");
    const canvasProps = canvasNodes[0].props as Record<string, (...args: unknown[]) => void>;

    // Draw something
    act(() => {
      canvasProps.onPointerDown({
        nativeEvent: {offsetX: 5, offsetY: 5},
        pointerId: 1,
      });
    });
    act(() => {
      canvasProps.onPointerMove({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });

    // Leave triggers pointerUp handler
    act(() => {
      canvasProps.onPointerLeave({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });

    expect(mockOnChange).toHaveBeenCalledWith("data:image/png;base64,AAAA");
    expect(mockOnEnd).toHaveBeenCalledTimes(1);
  });

  it("resets canvas and notifies parent on clear after drawing", () => {
    const mockOnChange = mock(() => {});
    const ctx = createMockContext();
    const {UNSAFE_root, getByText} = renderWithTheme(<Signature onChange={mockOnChange} />);

    patchCanvasRefs(UNSAFE_root, ctx);

    const canvasNodes = UNSAFE_root.findAll((node: {type: string}) => node.type === "canvas");
    const canvasProps = canvasNodes[0].props as Record<string, (...args: unknown[]) => void>;

    // Draw
    act(() => {
      canvasProps.onPointerDown({
        nativeEvent: {offsetX: 5, offsetY: 5},
        pointerId: 1,
      });
    });
    act(() => {
      canvasProps.onPointerMove({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });
    act(() => {
      canvasProps.onPointerUp({
        nativeEvent: {offsetX: 50, offsetY: 50},
        pointerId: 1,
      });
    });

    mockOnChange.mockClear();

    // Clear
    fireEvent.press(getByText("Clear"));

    expect(mockOnChange).toHaveBeenCalledWith("");
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
