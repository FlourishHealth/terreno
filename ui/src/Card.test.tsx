import {describe, expect, it, mock} from "bun:test";
import type {ScaledSize} from "react-native";
import {useWindowDimensions} from "react-native";
import type {ReactTestRendererJSON} from "react-test-renderer";

import {Card} from "./Card";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

type WindowDimensionsImpl = () => ScaledSize;
type MockableUseWindowDimensions = WindowDimensionsImpl & {
  mockImplementation?: (impl: WindowDimensionsImpl) => void;
};

const getScaledSize =
  (width: number): WindowDimensionsImpl =>
  (): ScaledSize => ({
    fontScale: 1,
    height: 1000,
    scale: 2,
    width,
  });

const setWindowWidth = (width: number): (() => void) => {
  const useWindowDimensionsMock = useWindowDimensions as MockableUseWindowDimensions;
  const dimensionsImpl = getScaledSize(width);

  if (typeof useWindowDimensionsMock.mockImplementation === "function") {
    useWindowDimensionsMock.mockImplementation(dimensionsImpl);

    return (): void => {
      useWindowDimensionsMock.mockImplementation(getScaledSize(375));
    };
  }

  return (): void => {};
};

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

    it("uses 8px spacing between the title and description", () => {
      const {toJSON} = renderWithTheme(
        <Card description="Body text" title="Feature Title" variant="display" />
      );
      const json = toJSON() as ReactTestRendererJSON;
      const contentBox = json.children?.[0] as ReactTestRendererJSON;
      const titleDescriptionBox = contentBox.children?.[0] as ReactTestRendererJSON;

      expect(titleDescriptionBox.props.style.gap).toBe(8);
    });

    it("uses a 600px width for the default display card size on desktop", () => {
      const restoreWindowWidth = setWindowWidth(1024);
      const {toJSON} = renderWithTheme(<Card title="Feature Title" variant="display" />);
      const json = toJSON() as ReactTestRendererJSON;

      restoreWindowWidth();

      expect(json.props.style.width).toBe(600);
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

  describe("editable variant", () => {
    it("renders correctly with all props", () => {
      const {toJSON} = renderWithTheme(
        <Card
          badge={{iconName: "check", secondary: true, status: "success", value: "Verified"}}
          description="123 Main Street"
          helperText="Last updated 2 days ago"
          iconName="location-dot"
          onEdit={() => {}}
          title="Home Address"
          variant="editable"
        />
      );
      expect(toJSON()).toMatchSnapshot();
    });

    it("renders title, description and helper text", () => {
      const {getByText} = renderWithTheme(
        <Card
          description="123 Main Street"
          helperText="Last updated 2 days ago"
          title="Home Address"
          variant="editable"
        />
      );
      expect(getByText("Home Address")).toBeTruthy();
      expect(getByText("123 Main Street")).toBeTruthy();
      expect(getByText("Last updated 2 days ago")).toBeTruthy();
    });

    it("renders the badge", () => {
      const {getByText} = renderWithTheme(
        <Card
          badge={{secondary: true, status: "success", value: "Verified"}}
          title="Home Address"
          variant="editable"
        />
      );
      expect(getByText("Verified")).toBeTruthy();
    });

    it("uses the attention surface when attention is set", () => {
      const {toJSON} = renderWithTheme(
        <Card attention description="123 Main Street" title="Home Address" variant="editable" />
      );
      const rendered = toJSON() as ReactTestRendererJSON;
      expect(rendered.props.style).toMatchObject({backgroundColor: "#F2F9FA"});
    });

    it("renders children below the text content", () => {
      const {getByText} = renderWithTheme(
        <Card title="Home Address" variant="editable">
          <Text>Extra content</Text>
        </Card>
      );
      expect(getByText("Extra content")).toBeTruthy();
    });

    it("renders with testID", () => {
      const {getByTestId} = renderWithTheme(
        <Card testID="editable-card" title="Home Address" variant="editable" />
      );
      expect(getByTestId("editable-card")).toBeTruthy();
    });
  });
});
