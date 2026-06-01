import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {View} from "react-native";

import {Signature} from "./Signature";
import {renderWithTheme} from "./test-utils";

describe("Signature", () => {
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

  it("scales the web canvas to the available container width", () => {
    const mockOnChange = mock(() => {});
    const {UNSAFE_getByType} = renderWithTheme(<Signature onChange={mockOnChange} />);
    const canvas = UNSAFE_getByType("canvas");
    expect(canvas.props.style).toMatchObject({maxWidth: "100%", width: "100%"});
  });

  it("allows the signature box to fill its parent", () => {
    const mockOnChange = mock(() => {});
    const {UNSAFE_getAllByType} = renderWithTheme(<Signature fullWidth onChange={mockOnChange} />);
    const wrapper = UNSAFE_getAllByType(View)[1];
    expect(wrapper.props.style).toMatchObject({maxWidth: undefined, width: "100%"});
  });

  it("maps scaled canvas pointer coordinates to the canvas buffer", () => {
    const mockOnChange = mock(() => {});
    const moveTo = mock(() => {});
    const lineTo = mock(() => {});
    const {UNSAFE_getByType} = renderWithTheme(<Signature onChange={mockOnChange} />);
    const canvas = UNSAFE_getByType("canvas");
    canvas.props.ref.current = {
      clientHeight: 180,
      clientWidth: 150,
      getBoundingClientRect: () => ({height: 180, width: 150}),
      getContext: () => ({
        beginPath: mock(() => {}),
        fillRect: mock(() => {}),
        lineCap: "round",
        lineJoin: "round",
        lineTo,
        moveTo,
        stroke: mock(() => {}),
      }),
      height: 180,
      setPointerCapture: mock(() => {}),
      width: 300,
    } as unknown as HTMLCanvasElement;

    canvas.props.onPointerDown({
      nativeEvent: {offsetX: 75, offsetY: 90},
      pointerId: 1,
    });
    canvas.props.onPointerMove({
      nativeEvent: {offsetX: 90, offsetY: 120},
      pointerId: 1,
    });

    expect(moveTo).toHaveBeenCalledWith(150, 90);
    expect(lineTo).toHaveBeenCalledWith(180, 120);
  });

  it("notifies the parent with an empty value when Clear is pressed", () => {
    const mockOnChange = mock(() => {});
    const {getByText} = renderWithTheme(<Signature onChange={mockOnChange} />);
    fireEvent.press(getByText("Clear"));
    // Clearing the canvas emits no draw event, so the component must push ""
    // directly or "signature required" gating in parents would never reset.
    expect(mockOnChange).toHaveBeenCalledWith("");
  });
});
