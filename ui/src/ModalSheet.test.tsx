import {describe, expect, it, mock} from "bun:test";
import {forwardRef, useRef} from "react";
import {Text, View} from "react-native";

import {SimpleContent, useCombinedRefs} from "./ModalSheet";
import {renderWithTheme} from "./test-utils";

// Mock react-native-modalize
mock.module("react-native-modalize", () => ({
  Modalize: forwardRef(({children}: {children: React.ReactNode}, ref) => (
    <View ref={ref as any} testID="modalize">
      {children}
    </View>
  )),
}));

// Mock react-native-portalize
mock.module("react-native-portalize", () => ({
  Portal: ({children}: {children: React.ReactNode}) => <View testID="portal">{children}</View>,
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
