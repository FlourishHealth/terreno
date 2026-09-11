import {describe, expect, it, mock} from "bun:test";
import {forwardRef, useRef} from "react";
import {Text, View} from "react-native";

import {SimpleContent, useCombinedRefs} from "./ModalSheet";
import {renderWithTheme} from "./test-utils";

// Mock react-native-modalize
mock.module("react-native-modalize", () => ({
  Modalize: forwardRef<React.ElementRef<typeof View>, {children: React.ReactNode}>(
    ({children}, ref) => (
      <View ref={ref} testID="modalize">
        {children}
      </View>
    )
  ),
}));

describe("ModalSheet", () => {
  it("renders correctly with children", () => {
    const {toJSON} = renderWithTheme(
      <SimpleContent>
        <Text>Test Content</Text>
      </SimpleContent>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("SimpleContent is defined", () => {
    expect(SimpleContent).toBeDefined();
  });

  it("useCombinedRefs is defined", () => {
    expect(useCombinedRefs).toBeDefined();
    expect(typeof useCombinedRefs).toBe("function");
  });

  it("useCombinedRefs combines multiple refs", () => {
    const TestComponent = () => {
      const ref1 = useRef<View>(null);
      const ref2 = useRef<View>(null);
      const combinedRef = useCombinedRefs(ref1, ref2);
      return <View ref={combinedRef} testID="combined-ref-view" />;
    };

    const {getByTestId} = renderWithTheme(<TestComponent />);
    expect(getByTestId("combined-ref-view")).toBeTruthy();
  });

  it("useCombinedRefs forwards the node to callback refs, object refs, and skips undefined", () => {
    const callbackRef = mock((_node: View | null) => {});
    const objectRef: {current: View | null} = {current: null};
    const TestComponent = () => {
      const combinedRef = useCombinedRefs<View>(callbackRef, undefined, objectRef);
      return <View ref={combinedRef} testID="combined-ref-view" />;
    };

    const {getByTestId} = renderWithTheme(<TestComponent />);
    expect(getByTestId("combined-ref-view")).toBeTruthy();
    expect(callbackRef).toHaveBeenCalledTimes(1);
    expect(objectRef.current).toBe(callbackRef.mock.calls[0][0]);
  });

  it("SimpleContent forwards its ref to the Modalize instance", () => {
    const forwarded = mock((_node: View | null) => {});
    renderWithTheme(
      <SimpleContent ref={forwarded}>
        <Text>Test Content</Text>
      </SimpleContent>
    );
    expect(forwarded).toHaveBeenCalledTimes(1);
  });
});
