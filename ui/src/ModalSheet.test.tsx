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
});
