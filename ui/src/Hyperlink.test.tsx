import {describe, expect, it} from "bun:test";
import {Text} from "react-native";

import {Hyperlink} from "./Hyperlink";
import {renderWithTheme} from "./test-utils";

describe("Hyperlink", () => {
  it("renders children correctly", () => {
    const {getByText} = renderWithTheme(
      <Hyperlink>
        <Text>Some text content</Text>
      </Hyperlink>
    );
    expect(getByText("Some text content")).toBeTruthy();
  });

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <Hyperlink>
        <Text>Hello world</Text>
      </Hyperlink>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders text with URLs", () => {
    const {toJSON} = renderWithTheme(
      <Hyperlink linkDefault>
        <Text>Check out https://example.com for more info</Text>
      </Hyperlink>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom link style", () => {
    const {toJSON} = renderWithTheme(
      <Hyperlink linkDefault linkStyle={{color: "blue", textDecorationLine: "underline"}}>
        <Text>Visit https://example.com</Text>
      </Hyperlink>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders plain text without linkDefault", () => {
    const {toJSON} = renderWithTheme(
      <Hyperlink>
        <Text>No links here https://example.com</Text>
      </Hyperlink>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
