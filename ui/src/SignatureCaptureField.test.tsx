import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import type {SignatureCaptureValue} from "./Common";
import {SignatureCaptureField} from "./SignatureCaptureField";
import {renderWithTheme} from "./test-utils";

describe("SignatureCaptureField", () => {
  const defaultProps = {
    onChange: () => {},
  };

  it("component is defined", () => {
    expect(SignatureCaptureField).toBeDefined();
    expect(typeof SignatureCaptureField).toBe("function");
  });

  it("renders both Draw and Type mode options", () => {
    const {getByText} = renderWithTheme(<SignatureCaptureField {...defaultProps} />);
    expect(getByText("Draw")).toBeTruthy();
    expect(getByText("Type")).toBeTruthy();
  });

  it("defaults to type mode and shows the typed name input", () => {
    const {getByText} = renderWithTheme(<SignatureCaptureField {...defaultProps} />);
    // The typed field renders its name input label.
    expect(getByText("Full name")).toBeTruthy();
  });

  it("respects defaultMode=draw and shows the draw hint", () => {
    const {getByText} = renderWithTheme(
      <SignatureCaptureField {...defaultProps} defaultMode="draw" />
    );
    expect(
      getByText("Draw your signature above, then it will be saved automatically.")
    ).toBeTruthy();
  });

  it("emits a typed value when the user types", () => {
    const onChange = mock((_v: SignatureCaptureValue) => {});
    const {UNSAFE_getAllByProps} = renderWithTheme(<SignatureCaptureField onChange={onChange} />);

    const inputs = UNSAFE_getAllByProps({}).filter(
      (el) => typeof el.props?.onChangeText === "function"
    );
    expect(inputs.length).toBeGreaterThan(0);
    inputs[0].props.onChangeText("Jane Doe");

    const [emitted] = onChange.mock.calls[0];
    expect(emitted.mode).toBe("type");
    expect(emitted).toMatchObject({mode: "type", typedName: "Jane Doe"});
  });

  it("emits a drawn value when the pad reports an image in draw mode", () => {
    const onChange = mock((_v: SignatureCaptureValue) => {});
    const {UNSAFE_getAllByProps} = renderWithTheme(
      <SignatureCaptureField defaultMode="draw" onChange={onChange} />
    );

    const drawPads = UNSAFE_getAllByProps({}).filter(
      (el) => typeof el.props?.onChange === "function" && "fullWidth" in (el.props ?? {})
    );
    expect(drawPads.length).toBeGreaterThan(0);
    drawPads[0].props.onChange("data:image/png;base64,abc");

    expect(onChange).toHaveBeenCalledWith({image: "data:image/png;base64,abc", mode: "draw"});
  });

  it("switches to draw mode when the Draw toggle is pressed", () => {
    const {getByText, queryByText} = renderWithTheme(<SignatureCaptureField {...defaultProps} />);
    // Starts in type mode: draw hint absent.
    expect(
      queryByText("Draw your signature above, then it will be saved automatically.")
    ).toBeNull();

    fireEvent.press(getByText("Draw"));

    expect(
      getByText("Draw your signature above, then it will be saved automatically.")
    ).toBeTruthy();
  });

  it("renders a read-only drawn image when disabled with a drawn value", () => {
    const {toJSON} = renderWithTheme(
      <SignatureCaptureField
        disabled
        onChange={() => {}}
        value={{image: "data:image/png;base64,xyz", mode: "draw"}}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("forwards the resolved input test id to the typed name input in type mode", () => {
    const {UNSAFE_getAllByProps} = renderWithTheme(
      <SignatureCaptureField {...defaultProps} testID="sig" />
    );
    // testID "sig" resolves to input id "sig" and is forwarded to the typed name input.
    const inputs = UNSAFE_getAllByProps({}).filter(
      (el) => typeof el.props?.onChangeText === "function"
    );
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs[0].props.testID).toBe("sig");
  });

  it("forwards the resolved input test id to the draw pad in draw mode", () => {
    const {UNSAFE_getAllByProps} = renderWithTheme(
      <SignatureCaptureField {...defaultProps} defaultMode="draw" testID="sig" />
    );
    // The draw pad is the node exposing both onChange and fullWidth; it should carry the id.
    const drawPads = UNSAFE_getAllByProps({}).filter(
      (el) => typeof el.props?.onChange === "function" && "fullWidth" in (el.props ?? {})
    );
    expect(drawPads.length).toBeGreaterThan(0);
    expect(drawPads[0].props.testID).toBe("sig");
  });

  it("forwards an explicit testIDs.input to the active control", () => {
    const {UNSAFE_getAllByProps} = renderWithTheme(
      <SignatureCaptureField {...defaultProps} testIDs={{input: "custom-input"}} />
    );
    const inputs = UNSAFE_getAllByProps({}).filter(
      (el) => typeof el.props?.onChangeText === "function"
    );
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs[0].props.testID).toBe("custom-input");
  });

  it("renders an error message when errorText is provided", () => {
    const {getByText} = renderWithTheme(
      <SignatureCaptureField {...defaultProps} errorText="A signature is required." />
    );
    expect(getByText("A signature is required.")).toBeTruthy();
  });
});
