import {describe, expect, it} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {InfoModalIcon} from "./InfoModalIcon";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("InfoModalIcon", () => {
  it("renders correctly with required props", () => {
    const {toJSON} = renderWithTheme(
      <InfoModalIcon infoModalText="This is information text" infoModalTitle="Info Title" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders info icon that can be pressed", () => {
    const {getByTestId} = renderWithTheme(
      <InfoModalIcon infoModalText="Help text" infoModalTitle="Help" />
    );
    const infoIcon = getByTestId("info-icon");
    expect(infoIcon).toBeTruthy();
  });

  it("renders with subtitle", () => {
    const {toJSON} = renderWithTheme(
      <InfoModalIcon
        infoModalSubtitle="Subtitle text"
        infoModalText="Main text content"
        infoModalTitle="Title"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with children content", () => {
    const {toJSON} = renderWithTheme(
      <InfoModalIcon
        infoModalChildren={<Text>Custom children content</Text>}
        infoModalText="Text content"
        infoModalTitle="Title"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("opens modal when pressed", () => {
    const {getByTestId, toJSON} = renderWithTheme(
      <InfoModalIcon infoModalText="Modal text" infoModalTitle="Modal Title" />
    );
    const infoIcon = getByTestId("info-icon");
    fireEvent.press(infoIcon);
    expect(toJSON()).toMatchSnapshot();
  });
});
