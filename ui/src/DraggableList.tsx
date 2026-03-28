// TODO: Open source into @terreno/ui
// Forked from https://github.com/gerwld/react-native-drag-n-drop-everywhere
// Because it only supported drag handles on the right, and installing it caused build issues.

// MIT License
// Copyright Patryk Jaworski @gerwld

import React, {useMemo, useState} from "react";
import {Platform, View} from "react-native";
import {Gesture, GestureDetector} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import {Box} from "./Box";
import {Icon} from "./Icon";

/**
 * Interface representing position mappings of items in the list
 * Maps item IDs to their numeric positions in the list
 */
interface Positions {
  [key: string]: number;
}

/**
 * Props for an individual draggable item in the list
 */
interface DragItemProps {
  item: string; // Unique identifier for the item
  index: number; // Original index of the item
  positions: {value: Positions}; // Shared value containing position mappings
  scrollY: {value: number}; // Scroll position value
  itemsGap: number; // Spacing between items
  itemsCount: number; // Total number of items in the list
  itemHeight: number; // Height of each item
  renderItem: (props: {item: string}) => React.ReactElement; // Function to render item content
  renderGrip?: React.ReactElement | (() => React.ReactElement); // Optional drag handle
  passVibration?: () => void; // Optional haptic feedback callback
  itemBorderRadius: number; // Border radius for items
  itemContainerStyle?: any; // Additional styling for item container
  callbackNewDataIds?: (newIds: string[]) => void; // Callback when items are reordered
  backgroundOnHold?: string; // Background color when item is being dragged
  plainPosition: number; // Current position in the list
}

/**
 * Props for the draggable list container component
 */
interface DragListProps {
  data?: string[]; // Array of item IDs (deprecated, use dataIDs)
  style?: any; // Style for the list container
  callbackNewDataIds: (newIds: string[]) => void; // Callback when items are reordered
  contentContainerStyle?: any; // Style for the content container
  itemContainerStyle?: any; // Style for each item container
  renderItem: (props: {item: string}) => React.ReactElement; // Function to render item content
  renderGrip?: React.ReactElement | (() => React.ReactElement); // Optional custom drag handle
  passVibration?: () => void; // Optional haptic feedback callback
  borderRadius?: number; // Border radius for the list
  backgroundOnHold?: string; // Background color when item is being dragged
  dataIDs?: string[]; // Array of item IDs (preferred over data)
  itemsGap?: number; // Spacing between items
  itemHeight?: number; // Height of each item
  itemBorderRadius?: number; // Border radius for items
}

/**
 * Processes the current positions and calls the callback with the new sorted array
 * This function is marked with "worklet" to allow it to run on the UI thread
 * See: https://docs.swmansion.com/react-native-reanimated/docs/guides/worklets/
 */
const onCallbackData = (
  positions: Positions,
  callbackNewDataIds: ((newIds: string[]) => void) | undefined,
  prevArrayFromPositions: React.MutableRefObject<string | null>
): void => {
  "worklet";

  // Sort items by their positions and extract the IDs
  const arrayFromPositions = Object.entries(positions)
    .sort(([, indexA], [, indexB]) => {
      const numIndexA = indexA as number;
      const numIndexB = indexB as number;
      return numIndexA - numIndexB;
    })
    .map(([id]) => id);

  const stringifiedArray = JSON.stringify(arrayFromPositions);

  // Only call the callback if the array has changed
  if (prevArrayFromPositions.current !== stringifiedArray) {
    prevArrayFromPositions.current = stringifiedArray;

    if (typeof callbackNewDataIds === "function") {
      callbackNewDataIds(arrayFromPositions);
    }
  }
};

/**
 * Clamps a value between a lower and upper bound
 * Marked as "worklet" to allow it to run on the UI thread
 */
const clamp = (value: number, lowerBound: number, upperBound: number): number => {
  "worklet";
  return Math.max(lowerBound, Math.min(value, upperBound));
};

/**
 * Swaps the positions of two items in the positions object
 * Used when items are being dragged to new positions
 * Marked as "worklet" to allow it to run on the UI thread
 */
const objectMove = (object: Positions, from: number, to: number): Positions => {
  "worklet";
  const newObject = Object.assign({}, object);
  for (const id in object) {
    if (object[id] === from) {
      newObject[id] = to;
    }
    if (object[id] === to) {
      newObject[id] = from;
    }
  }
  return newObject;
};

/**
 * Individual draggable item component
 * Handles the drag gesture and animations for a single item in the list
 */
export const DragItem: React.FC<DragItemProps> = (props) => {
  const {
    item,
    positions,
    scrollY,
    itemsGap,
    itemsCount,
    itemHeight,
    renderItem,
    renderGrip,
    passVibration,
    itemBorderRadius,
    itemContainerStyle,
    callbackNewDataIds,
    backgroundOnHold,
    plainPosition,
  } = props;

  // Ref to track previous array state to avoid unnecessary callbacks
  const prevArrayFromPositions = React.useRef<string | null>(null);

  // Shared values for animations and position tracking
  const pressed = useSharedValue(false);
  const offset = useSharedValue(0);
  const startY = useSharedValue(0);
  const top = useSharedValue(plainPosition * (itemHeight + itemsGap));
  const [moving, setMoving] = useState(false);

  // React to changes in positions when not actively moving
  useAnimatedReaction(
    () => positions.value,
    (currentPositions, prevPositions) => {
      if (currentPositions !== prevPositions && !moving && !top.value) {
        top.value = positions.value[item] * (itemHeight + itemsGap);
      }
    }
  );

  // React to changes in this item's position when not actively moving
  useAnimatedReaction(
    () => positions.value[item],
    (currentPosition, previousPosition) => {
      if (currentPosition !== previousPosition && !moving) {
        top.value = currentPosition * (itemHeight + itemsGap);
      }
    },
    [moving]
  );

  const isAndroid = Platform.OS === "android";

  // Define the animated styles for the item
  const animatedStyles = useAnimatedStyle(() => {
    let topOffset = top.value + offset.value;
    if (Number.isNaN(topOffset)) topOffset = 0;

    // Basic styles for all platforms
    const anim = {
      backgroundColor: pressed.value ? backgroundOnHold : "transparent",
      height: itemHeight,
      top: topOffset,
      zIndex: pressed.value ? 1 : 0,
    };

    // Enhanced styles with shadow for iOS
    const animBetter = {
      backgroundColor: pressed.value ? backgroundOnHold : "transparent",
      height: itemHeight,
      shadowOffset: {height: 0, width: 0},
      shadowOpacity: isAndroid ? 0 : withSpring(pressed.value ? 0.2 : 0),
      shadowRadius: isAndroid ? 0 : 5,
      top: topOffset,
      zIndex: pressed.value ? 1 : 0,
    };

    if (isAndroid) return anim;
    return animBetter;
  });

  // Define the pan gesture handler for dragging
  const pan = Gesture.Pan()
    .onBegin(() => {
      // When dragging starts
      pressed.value = true;
      runOnJS(setMoving)(true);
      if (passVibration) passVibration();
      startY.value = top.value;
    })
    .onChange((event) => {
      // While dragging
      offset.value = event.translationY;

      const positionY = startY.value + event.translationY + scrollY.value;

      // Calculate the new position based on the drag distance
      const newPosition = clamp(Math.floor(positionY / (itemHeight + itemsGap)), 0, itemsCount - 1);

      // If position changed, update the positions object
      if (newPosition !== positions.value[item]) {
        const newMove = objectMove(positions.value, positions.value[item], newPosition);
        if (newMove && typeof newMove === "object") {
          runOnJS(() => {
            positions.value = newMove;
          })();
        }

        // Trigger haptic feedback when position changes
        if (typeof passVibration === "function") runOnJS(passVibration)();
      }
    })
    .onFinalize(() => {
      // When dragging ends
      offset.value = 0;
      top.value = positions.value[item] * (itemHeight + itemsGap);
      pressed.value = false;

      // Notify about the new order
      onCallbackData(positions.value, callbackNewDataIds, prevArrayFromPositions);

      runOnJS(setMoving)(false);
    });

  return (
    <Animated.View
      style={[
        {
          alignItems: "center",
          borderRadius: itemBorderRadius,
          flexDirection: "row",
          marginBottom: itemsGap,
          paddingRight: 10,
          position: "absolute",
          width: "100%",
        },
        itemContainerStyle,
        animatedStyles,
      ]}
    >
      <GestureDetector gesture={pan}>
        {renderGrip ? (
          <View
            style={{
              alignItems: "center",
              flexBasis: 45,
              flexGrow: 0,
              flexShrink: 0,
              height: "100%",
              justifyContent: "center",
              minWidth: 45,
            }}
          >
            {typeof renderGrip === "function" ? renderGrip() : renderGrip}
          </View>
        ) : (
          <Box height="100%" justifyContent="center">
            <Icon iconName="arrows-up-down-left-right" />
          </Box>
        )}
      </GestureDetector>
      <View style={{flex: 1}}>{renderItem({item})}</View>
    </Animated.View>
  );
};

/**
 * Main draggable list component that renders a list of draggable items
 * Manages the order and positioning of items
 */
export const DraggableList: React.FC<DragListProps> = (props) => {
  const {
    data,
    callbackNewDataIds,
    itemContainerStyle,
    renderItem,
    renderGrip,
    passVibration,
    backgroundOnHold = "#e3e3e3",
  } = props;

  // Use dataIDs prop with fallback to data prop
  const dataIDs = useMemo(() => props?.dataIDs || data || [], [props?.dataIDs, data]);
  const itemsGap = props.itemsGap || 5;
  const itemHeight = props.itemHeight || 50;
  const itemBorderRadius = props.itemBorderRadius || 8;

  // Validate required props
  if (!dataIDs && !data) {
    throw new Error(
      'The "dataIDs / data" prop is missing. It should contain an array of identificators of your list items, for example, uuid\'s.'
    );
  }

  if ((dataIDs || data) && !Array.isArray(dataIDs || data)) {
    throw new Error(
      `The "dataIDs / data" prop should be []. \nProvided:${JSON.stringify(data || dataIDs)}`
    );
  }

  if (!renderItem) {
    throw new Error(
      'The "renderItem" prop is missing. You should pass R.C that will render your item based on identificator thar it recieves as {item: id} in the first argument. Example: `function renderItem({item}) {}`'
    );
  }

  if (!callbackNewDataIds) {
    throw new Error(
      'The "callbackNewDataIds" prop is missing. You should pass a function that will recieve an array of sorted items IDs. \n\nExample: `function getChanges(newArray) {}`\n\n* Mention: do not change dataIDs argument directly, or it will cause performance issues.`'
    );
  }

  if (typeof callbackNewDataIds !== "function") {
    throw new Error(
      `The "callbackNewDataIds" prop should be function type. \nProvided: ${JSON.stringify(
        renderGrip
      )}`
    );
  }

  // Function to extract key from item ID
  const keyExtractor = (id: string): string => id;

  /**
   * Converts an array of item IDs to a positions object
   * Maps each ID to its index in the array
   */
  function listToObject(list: string[]): Positions {
    const object: Positions = {};
    list.forEach((item, i) => {
      object[item] = i;
    });
    return object;
  }

  // Shared values for tracking positions and scroll
  const positions = useSharedValue(listToObject(dataIDs));
  const scrollY = useSharedValue(0);

  // Mirror positions.value to React state for safe access in render
  const [plainPositions, setPlainPositions] = React.useState<Positions>(() =>
    listToObject(dataIDs)
  );

  // Update plainPositions state when shared positions value changes
  useAnimatedReaction(
    () => positions.value,
    (currentPositions) => {
      runOnJS(setPlainPositions)({...currentPositions});
    },
    []
  );

  // Update positions when dataIDs changes
  // This effect ensures the positions shared value is updated when the dataIDs prop changes
  React.useEffect(() => {
    positions.value = listToObject(dataIDs);
  }, [dataIDs, positions]);

  return (
    <View
      style={{
        minHeight: dataIDs.length * itemHeight + (dataIDs.length - 1) * itemsGap,
        position: "relative",
        width: "100%",
      }}
    >
      {dataIDs?.map((item, index) => (
        <DragItem
          backgroundOnHold={backgroundOnHold}
          callbackNewDataIds={callbackNewDataIds}
          index={index}
          item={item}
          itemBorderRadius={itemBorderRadius}
          itemContainerStyle={itemContainerStyle}
          itemHeight={itemHeight}
          itemsCount={dataIDs.length}
          itemsGap={itemsGap}
          key={keyExtractor(item)}
          passVibration={passVibration}
          plainPosition={plainPositions[item] ?? 0}
          positions={positions}
          renderGrip={renderGrip}
          renderItem={renderItem}
          scrollY={scrollY}
        />
      ))}
    </View>
  );
};
