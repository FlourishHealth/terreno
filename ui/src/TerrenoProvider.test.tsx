import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";
import {Text, View} from "react-native";

import {TerrenoProvider} from "./TerrenoProvider";

describe("TerrenoProvider", () => {
  it("renders children correctly", () => {
    const {getByText} = render(
      <TerrenoProvider>
        <Text>Child content</Text>
      </TerrenoProvider>
    );
    expect(getByText("Child content")).toBeTruthy();
  });

  it("renders correctly with default props", () => {
    const {toJSON} = render(
      <TerrenoProvider>
        <View>
          <Text>App content</Text>
        </View>
      </TerrenoProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with openAPISpecUrl", () => {
    const {toJSON} = render(
      <TerrenoProvider openAPISpecUrl="https://api.example.com/openapi.json">
        <Text>Content</Text>
      </TerrenoProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
