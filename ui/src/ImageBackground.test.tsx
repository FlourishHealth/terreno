import {describe, expect, it} from "bun:test";

import {ImageBackground} from "./ImageBackground";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("ImageBackground", () => {
  it("renders correctly with source", () => {
    const {toJSON} = renderWithTheme(
      <ImageBackground source={{uri: "https://example.com/image.jpg"}}>
        <Text>Content over image</Text>
      </ImageBackground>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders children correctly", () => {
    const {getByText} = renderWithTheme(
      <ImageBackground source={{uri: "https://example.com/image.jpg"}}>
        <Text>Overlay text</Text>
      </ImageBackground>
    );
    expect(getByText("Overlay text")).toBeTruthy();
  });

  it("renders with custom style", () => {
    const {toJSON} = renderWithTheme(
      <ImageBackground
        source={{uri: "https://example.com/image.jpg"}}
        style={{height: 200, width: "100%"}}
      >
        <Text>Styled content</Text>
      </ImageBackground>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with local image source", () => {
    const {toJSON} = renderWithTheme(
      <ImageBackground source={require("./test-utils")}>
        <Text>Local image</Text>
      </ImageBackground>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
