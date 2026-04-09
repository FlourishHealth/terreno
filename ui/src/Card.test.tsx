import {describe, expect, it, mock} from "bun:test";

import {Card} from "./Card";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("Card", () => {
  describe("container variant (default)", () => {
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

  describe("display variant", () => {
    it("renders correctly with required props", () => {
      const {toJSON} = renderWithTheme(<Card title="Feature Title" variant="display" />);
      expect(toJSON()).toMatchSnapshot();
    });

    it("renders title", () => {
      const {getByText} = renderWithTheme(<Card title="My Feature" variant="display" />);
      expect(getByText("My Feature")).toBeTruthy();
    });

    it("renders description when provided", () => {
      const {getByText} = renderWithTheme(
        <Card description="Check out this new feature" title="My Feature" variant="display" />
      );
      expect(getByText("Check out this new feature")).toBeTruthy();
    });

    it("renders action button when buttonText and buttonOnClick are provided", () => {
      const onClick = mock(() => {});
      const {getByText} = renderWithTheme(
        <Card
          buttonOnClick={onClick}
          buttonText="Learn More"
          title="My Feature"
          variant="display"
        />
      );
      expect(getByText("Learn More")).toBeTruthy();
    });

    it("does not render button when only buttonText is provided", () => {
      const {queryByText} = renderWithTheme(
        <Card buttonText="Learn More" title="My Feature" variant="display" />
      );
      expect(queryByText("Learn More")).toBeNull();
    });

    it("renders children below structured content", () => {
      const {getByText} = renderWithTheme(
        <Card title="My Feature" variant="display">
          <Text>Extra content</Text>
        </Card>
      );
      expect(getByText("Extra content")).toBeTruthy();
    });

    it("renders image when imageUri is provided", () => {
      const {toJSON} = renderWithTheme(
        <Card
          imageAlt="Test image"
          imageUri="https://example.com/img.jpg"
          title="My Feature"
          variant="display"
        />
      );
      expect(toJSON()).toMatchSnapshot();
    });

    it("renders with testID", () => {
      const {getByTestId} = renderWithTheme(
        <Card testID="display-card" title="My Feature" variant="display" />
      );
      expect(getByTestId("display-card")).toBeTruthy();
    });
  });
});
