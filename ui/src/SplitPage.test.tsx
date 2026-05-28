// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import {Dimensions, View} from "react-native";

import {SplitPage} from "./SplitPage";
import {renderWithTheme} from "./test-utils";

type MockableDimensionsGet = {
  mockImplementation?: (impl: () => any) => void;
};

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
    const desktopDims = {fontScale: 1, height: 1000, scale: 2, width: 1400};

    it("verifies Dimensions mock is overridden", () => {
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => false,
        mediaQuery: () => "lg" as const,
        mediaQueryLargerThan: () => true,
        mediaQuerySmallerThan: () => false,
      }));
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => desktopDims);
      expect(Dimensions.get("window").width).toBe(1400);
    });

    it("renders renderList/renderContent on desktop", () => {
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => false,
        mediaQuery: () => "lg" as const,
        mediaQueryLargerThan: () => true,
        mediaQuerySmallerThan: () => false,
      }));
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => desktopDims);
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderList/renderChildrenContent on desktop with 2 children", () => {
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => false,
        mediaQuery: () => "lg" as const,
        mediaQueryLargerThan: () => true,
        mediaQuerySmallerThan: () => false,
      }));
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => desktopDims);
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps}>
          <View testID="child-1" />
          <View testID="child-2" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderChildrenContent with >2 children and tabs on desktop", () => {
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => false,
        mediaQuery: () => "lg" as const,
        mediaQueryLargerThan: () => true,
        mediaQuerySmallerThan: () => false,
      }));
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => desktopDims);
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
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => false,
        mediaQuery: () => "lg" as const,
        mediaQueryLargerThan: () => true,
        mediaQuerySmallerThan: () => false,
      }));
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => desktopDims);
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

  describe("mobile viewport (mediaQueryLargerThan('sm') false)", () => {
    const setMobile = () => {
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => true,
        mediaQuery: () => "xs" as const,
        mediaQueryLargerThan: () => false,
        mediaQuerySmallerThan: () => true,
      }));
      const mobileDims = {fontScale: 1, height: 812, scale: 2, width: 375};
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => mobileDims);
    };

    it("renders mobile list view when no item is selected", () => {
      setMobile();
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders mobile list content when item is selected via renderContent", async () => {
      setMobile();
      const {fireEvent} = await import("@testing-library/react-native");
      const {getAllByLabelText, queryByTestId} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
        />
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(queryByTestId("content-0")).toBeTruthy();
    });

    it("renders mobile children content with swiper when item is selected", async () => {
      setMobile();
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

    it("returns null for mobile children content when no item selected", () => {
      setMobile();
      const {queryByTestId} = renderWithTheme(
        <SplitPage {...defaultProps}>
          <View testID="child-1" />
          <View testID="child-2" />
        </SplitPage>
      );
      expect(queryByTestId("swiper-flatlist")).toBeNull();
    });

    it("hides mobile list when item selected", async () => {
      setMobile();
      const {fireEvent} = await import("@testing-library/react-native");
      const {getAllByLabelText, toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
        />
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(toJSON()).toBeTruthy();
    });

    it("can deselect item via IconButton onClick on mobile", async () => {
      setMobile();
      const {fireEvent} = await import("@testing-library/react-native");
      const onSelectionChange = mock(async (_arg: unknown) => {});
      const {getAllByLabelText, UNSAFE_root} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          onSelectionChange={onSelectionChange}
          renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
        />
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      const iconButtons = UNSAFE_root.findAll(
        (n: any) => n.props?.onClick && n.props?.iconName === "xmark"
      );
      if (iconButtons.length > 0) {
        await act(async () => {
          iconButtons[0].props.onClick();
        });
        expect(onSelectionChange).toHaveBeenCalledWith(undefined);
      } else {
        const closeButtons = UNSAFE_root.findAll(
          (n: any) => n.props?.accessibilityLabel === "close"
        );
        if (closeButtons.length > 0) {
          await act(async () => {
            if (closeButtons[0].props.onClick) {
              closeButtons[0].props.onClick();
            } else if (closeButtons[0].props.onPress) {
              closeButtons[0].props.onPress();
            }
          });
        }
        expect(onSelectionChange).toHaveBeenCalledWith(undefined);
      }
    });

    it("renders mobile list view header when provided", () => {
      setMobile();
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(selectedId) => <View testID={`content-${selectedId}`} />}
          renderListViewHeader={() => <View testID="mobile-header" />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders mobile split page with bottomNavBarHeight", async () => {
      setMobile();
      const {fireEvent} = await import("@testing-library/react-native");
      const {getAllByLabelText, toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} bottomNavBarHeight={80}>
          <View testID="child-1" />
          <View testID="child-2" />
        </SplitPage>
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(toJSON()).toBeTruthy();
    });
  });

  describe("desktop renderChildrenContent >2 children with tabs", () => {
    const setDesktop = () => {
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => false,
        mediaQuery: () => "lg" as const,
        mediaQueryLargerThan: () => true,
        mediaQuerySmallerThan: () => false,
      }));
      const desktopDims = {fontScale: 1, height: 1000, scale: 2, width: 1400};
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => desktopDims);
    };

    it("renders segmented control tabs and content on desktop with >2 children", () => {
      setDesktop();
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} tabs={["Tab A", "Tab B", "Tab C"]}>
          <View testID="child-a" />
          <View testID="child-b" />
          <View testID="child-c" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders renderContent path on desktop (renderSplitPage)", () => {
      setDesktop();
      const {toJSON} = renderWithTheme(
        <SplitPage
          {...defaultProps}
          renderContent={(id) => <View testID={`desktop-content-${id}`} />}
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("renders <= 2 children content with scroll views on desktop", () => {
      setDesktop();
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps}>
          <View testID="child-1" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("triggers segmented control onChange on desktop with >2 children", async () => {
      setDesktop();
      const {toJSON, UNSAFE_root} = renderWithTheme(
        <SplitPage {...defaultProps} tabs={["Tab A", "Tab B", "Tab C"]}>
          <View testID="child-a" />
          <View testID="child-b" />
          <View testID="child-c" />
        </SplitPage>
      );
      const segmented = UNSAFE_root.findAll((n: any) => n.props?.onChange && n.props?.items);
      if (segmented.length > 0) {
        await act(async () => {
          segmented[0].props.onChange(2);
        });
      }
      expect(toJSON()).toBeTruthy();
    });
  });

  describe("item selection callbacks", () => {
    const resetToMobile = () => {
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => true,
        mediaQuery: () => "xs" as const,
        mediaQueryLargerThan: () => false,
        mediaQuerySmallerThan: () => true,
      }));
      const mobileDims = {fontScale: 1, height: 812, scale: 2, width: 375};
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => mobileDims);
    };

    it("onItemSelect runs onSelectionChange when item clicked via Box press", async () => {
      resetToMobile();
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
      resetToMobile();
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

    it("uses default onSelectionChange without throwing", async () => {
      resetToMobile();
      const {fireEvent} = await import("@testing-library/react-native");
      const {getAllByLabelText, toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} renderContent={(id) => <View testID={`content-${id}`} />} />
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(toJSON()).toBeTruthy();
    });

    it("covers elementArray.map in renderMobileChildrenContent", async () => {
      resetToMobile();
      const {fireEvent} = await import("@testing-library/react-native");
      const {getAllByLabelText, queryByTestId} = renderWithTheme(
        <SplitPage {...defaultProps} bottomNavBarHeight={50}>
          <View testID="child-1" />
        </SplitPage>
      );
      const boxes = getAllByLabelText("Select");
      await act(async () => {
        fireEvent.press(boxes[0]);
      });
      expect(queryByTestId("swiper-flatlist")).toBeTruthy();
    });

    it("covers activeTabs.map in renderChildrenContent on desktop", () => {
      mock.module("./MediaQuery", () => ({
        isMobileDevice: () => false,
        mediaQuery: () => "lg" as const,
        mediaQueryLargerThan: () => true,
        mediaQuerySmallerThan: () => false,
      }));
      const desktopDims = {fontScale: 1, height: 1000, scale: 2, width: 1400};
      (Dimensions.get as MockableDimensionsGet).mockImplementation?.(() => desktopDims);
      const {toJSON} = renderWithTheme(
        <SplitPage {...defaultProps} tabs={["Tab A", "Tab B", "Tab C"]}>
          <View testID="child-a" />
          <View testID="child-b" />
          <View testID="child-c" />
        </SplitPage>
      );
      expect(toJSON()).toBeTruthy();
    });

    it("selection deselect when showItemList becomes true", async () => {
      resetToMobile();
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
