import {describe, expect, it, mock} from "bun:test";
import {View} from "react-native";

import {SplitPage} from "./SplitPage";
import {renderWithTheme} from "./test-utils";

// Mock react-native-swiper-flatlist
mock.module("react-native-swiper-flatlist", () => ({
  SwiperFlatList: ({children}: {children: React.ReactNode}) => (
    <View testID="swiper-flatlist">{children}</View>
  ),
}));

describe("SplitPage", () => {
  const defaultProps = {
    listViewData: [
      {id: "1", name: "Item 1"},
      {id: "2", name: "Item 2"},
    ],
    renderListViewItem: ({item}: {item: {id: string; name: string}}) => (
      <View testID={`item-${item.id}`} />
    ),
  };

  it("renders correctly with renderContent", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage
        {...defaultProps}
        renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly with children", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage {...defaultProps}>
        <View testID="child-1" />
        <View testID="child-2" />
      </SplitPage>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(SplitPage).toBeDefined();
    expect(typeof SplitPage).toBe("function");
  });

  it("renders with loading state", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage
        {...defaultProps}
        loading
        renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom color", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage
        {...defaultProps}
        color="primary"
        renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with tabs when more than 2 children", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage {...defaultProps} tabs={["Tab 1", "Tab 2", "Tab 3"]}>
        <View testID="child-1" />
        <View testID="child-2" />
        <View testID="child-3" />
      </SplitPage>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
