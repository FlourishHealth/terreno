import {describe, expect, it} from "bun:test";
import type {ReactTestRendererJSON} from "react-test-renderer";

import {EditableCard} from "./EditableCard";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("EditableCard", () => {
  it("renders correctly with all props", () => {
    const {toJSON} = renderWithTheme(
      <EditableCard
        badge={{iconName: "check", secondary: true, status: "success", value: "Verified"}}
        description="123 Main Street"
        helperText="Last updated 2 days ago"
        iconName="location-dot"
        onEdit={() => {}}
        title="Home Address"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders title, description and helper text", () => {
    const {getByText} = renderWithTheme(
      <EditableCard
        description="123 Main Street"
        helperText="Last updated 2 days ago"
        title="Home Address"
      />
    );
    expect(getByText("Home Address")).toBeTruthy();
    expect(getByText("123 Main Street")).toBeTruthy();
    expect(getByText("Last updated 2 days ago")).toBeTruthy();
  });

  it("renders the badge", () => {
    const {getByText} = renderWithTheme(
      <EditableCard
        badge={{secondary: true, status: "success", value: "Verified"}}
        title="Home Address"
      />
    );
    expect(getByText("Verified")).toBeTruthy();
  });

  it("uses the attention surface when attention is set", () => {
    const {toJSON} = renderWithTheme(
      <EditableCard attention description="123 Main Street" title="Home Address" />
    );
    const rendered = toJSON() as ReactTestRendererJSON;
    expect(rendered.props.style).toMatchObject({backgroundColor: "#F2F9FA"});
  });

  it("renders children below the text content", () => {
    const {getByText} = renderWithTheme(
      <EditableCard title="Home Address">
        <Text>Extra content</Text>
      </EditableCard>
    );
    expect(getByText("Extra content")).toBeTruthy();
  });

  it("renders with testID", () => {
    const {getByTestId} = renderWithTheme(
      <EditableCard testID="editable-card" title="Home Address" />
    );
    expect(getByTestId("editable-card")).toBeTruthy();
  });
});
