import {describe, expect, it} from "bun:test";

import {Body} from "./Body";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("Body", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <Body>
        <Text>Body content</Text>
      </Body>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders children correctly", () => {
    const {getByText} = renderWithTheme(
      <Body>
        <Text>Test content</Text>
      </Body>
    );
    expect(getByText("Test content")).toBeTruthy();
  });

  it("renders with scroll enabled", () => {
    const {toJSON} = renderWithTheme(
      <Body scroll>
        <Text>Scrollable content</Text>
      </Body>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with loading state", () => {
    const {toJSON} = renderWithTheme(
      <Body loading>
        <Text>Content</Text>
      </Body>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom padding", () => {
    const {toJSON} = renderWithTheme(
      <Body padding={10}>
        <Text>Content</Text>
      </Body>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom height", () => {
    const {toJSON} = renderWithTheme(
      <Body height={500}>
        <Text>Content</Text>
      </Body>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without keyboard avoiding when avoidKeyboard is false", () => {
    const {toJSON} = renderWithTheme(
      <Body avoidKeyboard={false}>
        <Text>Content</Text>
      </Body>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with keyboard avoiding by default", () => {
    const {toJSON} = renderWithTheme(
      <Body>
        <Text>Content</Text>
      </Body>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
