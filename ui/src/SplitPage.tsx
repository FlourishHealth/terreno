import React, {Children, useCallback, useEffect, useState} from "react";
import {Dimensions, type ListRenderItemInfo, ScrollView, View} from "react-native";
import {SwiperFlatList} from "react-native-swiper-flatlist";

import {Box} from "./Box";
import type {SplitPageProps} from "./Common";
import {FlatList} from "./FlatList";
import {IconButton} from "./IconButton";
import {mediaQueryLargerThan} from "./MediaQuery";
import {SegmentedControl} from "./SegmentedControl";
import {Spinner} from "./Spinner";
import {useTheme} from "./Theme";

// A component for rendering a list on one side and a details view on the right for large screens,
// and a scrollable list where clicking an item takes you the details view.
export const SplitPage = ({
  children,
  tabs = [],
  loading = false,
  color,
  keyboardOffset,
  renderListViewItem,
  renderListViewHeader,
  renderContent,
  onSelectionChange = () => {},
  listViewData,
  listViewExtraData,
  listViewWidth,
  listViewMaxWidth,
  bottomNavBarHeight,
  showItemList,
}: SplitPageProps) => {
  const {theme} = useTheme();
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const [activeTabs, setActiveTabs] = useState<number[]>([0, 1]);
  const {width} = Dimensions.get("window");

  const isMobileDevice = !mediaQueryLargerThan("sm");

  const elementArray = Children.toArray(children).filter((c) => c !== null);

  const onItemSelect = useCallback(
    async (item: ListRenderItemInfo<any>): Promise<void> => {
      setSelectedId(item.index);
      await onSelectionChange(item);
    },
    [onSelectionChange]
  );

  const onItemDeselect = useCallback(async () => {
    setSelectedId(undefined);
    await onSelectionChange(undefined);
  }, [onSelectionChange]);

  // If the list is showing, deselect the item.
  useEffect(() => {
    if (showItemList) {
      void onItemDeselect();
    }
  }, [showItemList, onItemDeselect]);

  if (!children && !renderContent) {
    console.warn("A child node is required");
    return null;
  }

  if (elementArray.length > 2 && elementArray.length !== tabs.length) {
    console.warn("There must be a tab for each child");
    return null;
  }

  const renderItem = (itemInfo: ListRenderItemInfo<any>) => {
    return (
      <Box
        accessibilityHint=""
        accessibilityLabel="Select"
        onClick={async () => {
          await onItemSelect(itemInfo);
        }}
      >
        {renderListViewItem(itemInfo)}
      </Box>
    );
  };

  const renderList = () => {
    return (
      <View
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          flexShrink: 0,
          maxWidth: listViewMaxWidth ?? listViewWidth ?? 300,
          width: listViewWidth ?? 300,
        }}
      >
        {renderListViewHeader?.()}
        <FlatList
          data={listViewData}
          extraData={listViewExtraData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      </View>
    );
  };

  const renderListContent = () => {
    return (
      <Box flex="grow" padding={2}>
        {renderContent?.(selectedId)}
      </Box>
    );
  };

  const renderChildrenContent = () => {
    if (Array.isArray(children) && elementArray.length > 2) {
      return (
        <View
          style={{
            alignItems: "center",
            flex: 1,
            height: "100%",
            width: "100%",
          }}
        >
          <Box marginBottom={4} paddingX={4} width="100%">
            <SegmentedControl
              items={tabs}
              onChange={(index) => {
                setActiveTabs([...([index] as number[])]);
              }}
              selectedIndex={activeTabs[0]}
            />
          </Box>
          <Box
            direction="row"
            flex="grow"
            height="100%"
            paddingX={4}
            width={activeTabs.length > 1 ? "100%" : "60%"}
          >
            {activeTabs.map((tabIndex, i) => {
              return (
                <ScrollView
                  contentContainerStyle={{
                    flex: 1,
                  }}
                  key={tabIndex}
                  style={{
                    flex: 1,
                    height: "100%",
                    paddingLeft: i ? 16 : 0,
                    paddingRight: i ? 0 : 16,
                    width: "60%",
                  }}
                >
                  {elementArray[tabIndex]}
                </ScrollView>
              );
            })}
          </Box>
        </View>
      );
    } else {
      return (
        <Box alignItems="center" direction="row" flex="grow" justifyContent="center" paddingX={2}>
          {elementArray.map((element, index) => {
            return (
              <ScrollView
                contentContainerStyle={{
                  flex: 1,
                }}
                key={index}
                style={{
                  flex: 1,
                  height: "100%",
                  width: "60%",
                }}
              >
                {element}
              </ScrollView>
            );
          })}
        </Box>
      );
    }
  };

  const renderMobileList = () => {
    if (isMobileDevice && selectedId !== undefined) {
      return null;
    }

    return (
      <View
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          flexShrink: 0,
          height: "100%",
          maxWidth: "100%",
          width: "100%",
        }}
      >
        {renderListViewHeader?.()}
        <FlatList
          data={listViewData}
          extraData={listViewExtraData}
          keyExtractor={(item) => item.id}
          nestedScrollEnabled
          renderItem={renderItem}
        />
      </View>
    );
  };

  const renderMobileListContent = () => {
    if (isMobileDevice && selectedId === undefined) {
      return null;
    }

    return (
      <Box flex="grow" padding={2}>
        {isMobileDevice && (
          <Box width="100%">
            <IconButton
              accessibilityHint="close split page"
              accessibilityLabel="close"
              iconName="xmark"
              onClick={() => onItemDeselect()}
            />
          </Box>
        )}
        {renderContent?.(selectedId)}
      </Box>
    );
  };

  const renderMobileChildrenContent = () => {
    if (selectedId === undefined) {
      return null;
    }
    return (
      <SwiperFlatList
        nestedScrollEnabled
        paginationStyle={{justifyContent: "center", width: "95%"}}
        renderAll
        showPagination
        style={{width: "100%"}}
      >
        {elementArray.map((element, i) => {
          return (
            <View
              key={i}
              style={{
                height: elementArray.length > 1 ? "90%" : "100%",
                padding: 4,
                paddingBottom: bottomNavBarHeight,
                width: width - 8,
              }}
            >
              {element}
            </View>
          );
        })}
      </SwiperFlatList>
    );
  };

  const renderSplitPage = () => {
    return (
      <>
        {renderList()}
        {renderContent ? renderListContent() : renderChildrenContent()}
      </>
    );
  };

  const renderMobileSplitPage = () => {
    const renderMainContent = renderContent
      ? renderMobileListContent()
      : renderMobileChildrenContent();
    return selectedId === undefined ? renderMobileList() : renderMainContent;
  };

  return (
    <Box
      avoidKeyboard
      color={color || "neutralLight"}
      direction="row"
      display="flex"
      height="100%"
      keyboardOffset={keyboardOffset}
      padding={2}
      width="100%"
    >
      {loading === true && <Spinner color={theme.text.primary as any} size="md" />}
      {isMobileDevice ? renderMobileSplitPage() : renderSplitPage()}
    </Box>
  );
};
