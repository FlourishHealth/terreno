declare module "react-native-swiper-flatlist" {
  import type {ReactNode} from "react";
  import type {FlatListProps, StyleProp, ViewStyle} from "react-native";

  export interface SwiperFlatListProps<T> extends Omit<FlatListProps<T>, "renderItem"> {
    autoplay?: boolean;
    autoplayDelay?: number;
    autoplayLoop?: boolean;
    autoplayLoopKeepAnimation?: boolean;
    children?: ReactNode;
    data?: T[];
    disableGesture?: boolean;
    index?: number;
    onChangeIndex?: (params: {index: number; prevIndex: number}) => void;
    onMomentumScrollEnd?: (params: {index: number}) => void;
    onViewableItemsChanged?: (info: {
      viewableItems: Array<{index: number | null}>;
      changed: Array<{index: number | null}>;
    }) => void;
    paginationActiveColor?: string;
    paginationDefaultColor?: string;
    paginationStyle?: StyleProp<ViewStyle>;
    paginationStyleItem?: StyleProp<ViewStyle>;
    paginationStyleItemActive?: StyleProp<ViewStyle>;
    paginationStyleItemInactive?: StyleProp<ViewStyle>;
    renderAll?: boolean;
    renderItem?: FlatListProps<T>["renderItem"];
    showPagination?: boolean;
    useReactNativeGestureHandler?: boolean;
    vertical?: boolean;
    viewabilityConfig?: FlatListProps<T>["viewabilityConfig"];
    e2eID?: string;
  }

  export interface SwiperFlatListRefProps {
    getCurrentIndex: () => number;
    getPrevIndex: () => number;
    goToFirstIndex: () => void;
    goToLastIndex: () => void;
    scrollToIndex: (params: {index: number; animated?: boolean}) => void;
  }

  export const SwiperFlatList: React.ForwardRefExoticComponent<
    SwiperFlatListProps<any> & React.RefAttributes<SwiperFlatListRefProps>
  >;

  export const Pagination: React.FC<{
    paginationActiveColor?: string;
    paginationDefaultColor?: string;
    paginationStyle?: StyleProp<ViewStyle>;
    paginationStyleItem?: StyleProp<ViewStyle>;
    paginationStyleItemActive?: StyleProp<ViewStyle>;
    paginationStyleItemInactive?: StyleProp<ViewStyle>;
    size?: number;
  }>;
}
