import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import {Dimensions, View} from "react-native";

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

  it("returns null when no children and no renderContent", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage listViewData={[]} renderListViewItem={() => null} />
    );
    expect(toJSON()).toBeNull();
  });

  it("returns null when tabs count does not match children count", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage {...defaultProps} tabs={["Tab 1"]}>
        <View testID="child-1" />
        <View testID="child-2" />
        <View testID="child-3" />
      </SplitPage>
    );
    expect(toJSON()).toBeNull();
  });

  it("renders with list view header", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage
        {...defaultProps}
        renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
        renderListViewHeader={() => <View testID="list-header" />}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom list view width and max width", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage
        {...defaultProps}
        listViewMaxWidth={500}
        listViewWidth={400}
        renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with listViewExtraData", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage
        {...defaultProps}
        listViewExtraData={{counter: 1}}
        renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with keyboard offset", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage
        {...defaultProps}
        keyboardOffset={100}
        renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("filters out null children", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage {...defaultProps}>
        <View testID="child-1" />
        {null}
        <View testID="child-2" />
      </SplitPage>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with showItemList true to reset selection", () => {
    const onSelectionChange = mock(() => {});
    const {toJSON} = renderWithTheme(
      <SplitPage
        {...defaultProps}
        onSelectionChange={onSelectionChange}
        renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
        showItemList
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with bottomNavBarHeight", () => {
    const {toJSON} = renderWithTheme(
      <SplitPage {...defaultProps} bottomNavBarHeight={60}>
        <View testID="child-1" />
      </SplitPage>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  describe("desktop viewport (mediaQueryLargerThan('sm') true)", () => {
    const desktopImpl = () => ({fontScale: 1, height: 1000, scale: 2, width: 1400}) as any;
    const mobileImpl = () => ({fontScale: 1, height: 812, scale: 2, width: 375}) as any;
    let originalGet: typeof Dimensions.get;
    beforeAll(() => {
      originalGet = Dimensions.get;
      if (typeof (Dimensions.get as any).mockImplementation === "function") {
        (Dimensions.get as any).mockImplementation(desktopImpl);
      } else {
        (Dimensions.get as any) = desktopImpl;
      }
    });
    afterAll(() => {
      if (typeof (Dimensions.get as any).mockImplementation === "function") {
        (Dimensions.get as any).mockImplementation(mobileImpl);
      } else {
        (Dimensions.get as any) = originalGet;
      }
    });

    it("verifies Dimensions mock is overridden", () => {
      expect(Dimensions.get("window").width).toBe(1400);
    });

    it("renders renderList/renderContent on desktop", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderList/renderChildrenContent on desktop with 2 children", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps}>
          <View testID="child-1" />
          <View testID="child-2" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderChildrenContent with >2 children and tabs on desktop", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} tabs={["A", "B", "C"]}>
          <View testID="child-1" />
          <View testID="child-2" />
          <View testID="child-3" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders with listViewWidth/listViewMaxWidth applied", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          listViewMaxWidth={400}
          listViewWidth={350}
          renderContent={(id) => <View testID={`content-${id}`} />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe("item selection callbacks", () => {
    it("onItemSelect runs onSelectionChange when item clicked via Box press", async () => {
      const {fireEvent} = await import("@testing-library/react-native");
      const onSelectionChange = mock(async (_arg: unknown) => {});
      const {getAllByLabelText} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          onSelectionChange={onSelectionChange}
          renderContent={(id) => <View testID={`content-${id}`} />}
        />
      );

      const boxes = getAllByLabelText("Select");
      expect(boxes.length).toBeGreaterThan(0);
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(onSelectionChange).toHaveBeenCalled();
    });

    it("selecting an item shows mobile children content when no renderContent", async () => {
      const {fireEvent} = await import("@testing-library/react-native");
      const {getAllByLabelText, queryByTestId} = renderWithTheme(
        <SplitPage {...defaultProps}>
          <View testID="child-1" />
          <View testID="child-2" />
        </SplitPage>
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(queryByTestId("swiper-flatlist")).toBeTruthy();
    });

    it("selection deselect when showItemList becomes true", async () => {
      const onSelectionChange = mock(async () => {});
      const {rerender} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          onSelectionChange={onSelectionChange}
          renderContent={(id) => <View testID={`content-${id}`} />}
        />
      );

      await act(async () => {
        rerender(
          <SplitPage
            {...defaultProps}
            onSelectionChange={onSelectionChange}
            renderContent={(id) => <View testID={`content-${id}`} />}
            showItemList
          />
        );
      });

      // showItemList=true triggers onItemDeselect -> onSelectionChange(undefined)
      expect(onSelectionChange).toHaveBeenCalled();
    });
  });
});
