import {describe, expect, it} from "bun:test";

import {Text} from "react-native";
import {renderWithTheme} from "../test-utils";
import {Swiper} from "./Swiper";

describe("Swiper", () => {
  const mockPages = [
    {subtitle: "Get started with our app", title: "Welcome"},
    {subtitle: "Discover what we offer", title: "Features"},
    {subtitle: "Create your account", title: "Ready?"},
  ];

  it("renders with pages", () => {
    const {getByTestId} = renderWithTheme(<Swiper pages={mockPages} testID="swiper" />);
    expect(getByTestId("swiper")).toBeTruthy();
  });

  it("renders nothing when pages is empty", () => {
    const {queryByTestId} = renderWithTheme(<Swiper pages={[]} testID="swiper" />);
    expect(queryByTestId("swiper")).toBeNull();
  });

  it("renders page titles", () => {
    const {getByText} = renderWithTheme(<Swiper pages={mockPages} />);
    expect(getByText("Welcome")).toBeTruthy();
  });

  it("renders page subtitles", () => {
    const {getByText} = renderWithTheme(<Swiper pages={mockPages} />);
    expect(getByText("Get started with our app")).toBeTruthy();
  });

  it("renders custom content", () => {
    const pagesWithContent = [
      {content: <Text testID="custom-content">Custom Content</Text>, title: "Custom"},
    ];
    const {getByTestId} = renderWithTheme(<Swiper pages={pagesWithContent} />);
    expect(getByTestId("custom-content")).toBeTruthy();
  });

  it("renders correctly", () => {
    const {toJSON} = renderWithTheme(<Swiper pages={mockPages} testID="swiper" />);
    expect(toJSON()).toMatchSnapshot();
  });
});
