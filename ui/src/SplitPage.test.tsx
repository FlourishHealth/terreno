// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import {View} from "react-native";

import {IconButton} from "./IconButton";
import {mediaQueryLargerThan} from "./MediaQuery";
import {SplitPage} from "./SplitPage";
import {renderWithTheme} from "./test-utils";

// Mock react-native-swiper-flatlist
mock.module("react-native-swiper-flatlist", () => ({
  SwiperFlatList: ({children}: {children: React.ReactNode}) => (
    <View testID="swiper-flatlist">{children}</View>
  ),
}));

const mockMediaQueryLargerThan = mediaQueryLargerThan as any;

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

  describe("mobile rendering (default: mediaQueryLargerThan=false, isMobileDevice=true)", () => {
    it("renders mobile list when no item is selected", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} renderContent={(id) => <View testID={`content-${id}`} />} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders mobile list with header", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(id) => <View testID={`content-${id}`} />}
          renderListViewHeader={() => <View testID="mobile-header" />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderMobileListContent after selecting item with renderContent", async () => {
      const {fireEvent} = await import("@testing-library/react-native");
      const onSelectionChange = mock(async (_arg: unknown) => {});
      const {getAllByLabelText, toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          onSelectionChange={onSelectionChange}
          renderContent={(id) => <View testID={`content-${id}`} />}
        />
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      expect(toJSON()).toBeTruthy();
    });

    it("triggers onItemDeselect via IconButton close button on mobile", async () => {
      const {fireEvent} = await import("@testing-library/react-native");
      const onSelectionChange = mock(async (_arg: unknown) => {});
      const {getAllByLabelText, UNSAFE_getAllByType} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          onSelectionChange={onSelectionChange}
          renderContent={(id) => <View testID={`content-${id}`} />}
        />
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);

      const iconButtons = UNSAFE_getAllByType(IconButton as any);
      const closeBtn = iconButtons.find((b: any) => b.props.accessibilityLabel === "close");
      expect(closeBtn).toBeTruthy();
      await act(async () => {
        closeBtn!.props.onClick();
      });
      expect(onSelectionChange).toHaveBeenCalledTimes(2);
    });

    it("renders renderMobileChildrenContent with SwiperFlatList after selection", async () => {
      const {fireEvent} = await import("@testing-library/react-native");
      const {getAllByLabelText, queryByTestId} = renderWithTheme(
        <SplitPage {...defaultProps} bottomNavBarHeight={60}>
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

    it("renders null and warns when no children or renderContent", () => {
      const origWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (msg: string) => warnings.push(msg);
      const {toJSON} = renderWithTheme(
        <SplitPage
          listViewData={defaultProps.listViewData}
          renderListViewItem={defaultProps.renderListViewItem}
        />
      );
      expect(warnings.some((w) => w.includes("child node"))).toBe(true);
      console.warn = origWarn;
      expect(toJSON()).toBeNull();
    });

    it("renders null when >2 children but tabs count mismatch", () => {
      const origWarn = console.warn;
      console.warn = () => {};
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} tabs={["A"]}>
          <View testID="child-1" />
          <View testID="child-2" />
          <View testID="child-3" />
        </SplitPage>
      );
      console.warn = origWarn;
      expect(toJSON()).toBeNull();
    });

    it("renders with loading spinner", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} loading>
          <View testID="child-1" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("deselects item via showItemList prop change", async () => {
      const onSelectionChange = mock(async (_arg: unknown) => {});
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
      expect(onSelectionChange).toHaveBeenCalled();
    });

    it("renders mobile list view without selecting", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps}>
          <View testID="child-1" />
          <View testID="child-2" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe("desktop rendering (mediaQueryLargerThan=true, isMobileDevice=false)", () => {
    beforeAll(() => {
      mockMediaQueryLargerThan.mockImplementation(() => true);
    });
    afterAll(() => {
      mockMediaQueryLargerThan.mockImplementation(() => false);
    });

    it("renders renderSplitPage with renderList and renderListContent", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} renderContent={(id) => <View testID={`content-${id}`} />} />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderList with header on desktop", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(id) => <View testID={`content-${id}`} />}
          renderListViewHeader={() => <View testID="desktop-header" />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderChildrenContent with <=2 children", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps}>
          <View testID="child-1" />
          <View testID="child-2" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderChildrenContent with >2 children and tabs", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} tabs={["Tab A", "Tab B", "Tab C"]}>
          <View testID="child-a" />
          <View testID="child-b" />
          <View testID="child-c" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders with custom listViewWidth and listViewMaxWidth", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          listViewMaxWidth={500}
          listViewWidth={400}
          renderContent={(id) => <View testID={`content-${id}`} />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders single child without tabs", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps}>
          <View testID="solo-child" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("selects an item and renders content on desktop", async () => {
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
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(onSelectionChange).toHaveBeenCalled();
    });

    it("triggers SegmentedControl onChange when tab is pressed", async () => {
      const {fireEvent} = await import("@testing-library/react-native");
      const {getByText} = renderWithTheme(
        <SplitPage {...defaultProps} tabs={["Tab A", "Tab B", "Tab C"]}>
          <View testID="child-a" />
          <View testID="child-b" />
          <View testID="child-c" />
        </SplitPage>
      );
      const tabB = getByText("Tab B");
      await act(async () => {
        fireEvent.press(tabB);
      });
      expect(tabB).toBeTruthy();
    });

    it("renders with bottomNavBarHeight on desktop", () => {
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} bottomNavBarHeight={60}>
          <View testID="child-1" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });
  });
});
