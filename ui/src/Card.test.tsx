import {describe, expect, it} from "bun:test";

import {Card} from "./Card";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("Card", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(
      <Card>
        <Text>Card content</Text>
      </Card>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders children correctly", () => {
    const {getByText} = renderWithTheme(
      <Card>
        <Text>Test content</Text>
      </Card>
    );
    expect(getByText("Test content")).toBeTruthy();
  });

  it("applies custom padding", () => {
    const {toJSON} = renderWithTheme(
      <Card padding={8}>
        <Text>Content</Text>
      </Card>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("applies custom color", () => {
    const {toJSON} = renderWithTheme(
      <Card color="secondary">
        <Text>Content</Text>
      </Card>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("passes additional Box props", () => {
    const {toJSON} = renderWithTheme(
      <Card gap={2} marginTop={4}>
        <Text>Content</Text>
      </Card>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with testID", () => {
    const {getByTestId} = renderWithTheme(
      <Card testID="test-card">
        <Text>Content</Text>
      </Card>
    );
    expect(getByTestId("test-card")).toBeTruthy();
  });
});
