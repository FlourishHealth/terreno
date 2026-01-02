import {Box, SegmentedControl, type SegmentedControlProps} from "@terreno/ui";
import {useState} from "react";

export const SegmentedControlDemo = (props: Partial<SegmentedControlProps>) => {
  const [index, setIndex] = useState(0);
  return (
    <Box display="flex" width="100%">
      <SegmentedControl
        items={["One", "Two", "Three"]}
        onChange={setIndex}
        selectedIndex={index}
        {...props}
      />
    </Box>
  );
};

export const DefaultControl = () => {
  const [itemIndex, setItemIndex] = useState(0);
  return (
    <Box display="flex" width={300}>
      <SegmentedControl
        items={["One", "Two", "Three"]}
        onChange={(activeIndex) => setItemIndex(activeIndex as number)}
        selectedIndex={itemIndex}
      />
    </Box>
  );
};

export const LargeControl = () => {
  const [itemIndex, setItemIndex] = useState(0);
  return (
    <Box display="flex" width="100%">
      <SegmentedControl
        items={["One", "Two", "Three"]}
        onChange={(activeIndex) => setItemIndex(activeIndex as number)}
        selectedIndex={itemIndex}
        size="lg"
      />
    </Box>
  );
};

export const OverflowControl = () => {
  const [itemIndex, setItemIndex] = useState(0);
  return (
    <Box display="flex" width={300}>
      <SegmentedControl
        items={["One", "Two", "Three Four Five Six Seven"]}
        onChange={(activeIndex) => setItemIndex(activeIndex as number)}
        selectedIndex={itemIndex}
      />
    </Box>
  );
};

export const WithBadges = () => {
  const [itemIndex, setItemIndex] = useState(0);
  return (
    <Box display="flex" width={300}>
      <SegmentedControl
        badges={[{count: 10}, {count: 5, status: "success"}, {count: 2, status: "warning"}]}
        items={["Inbox", "Sent", "Drafts"]}
        onChange={(activeIndex) => setItemIndex(activeIndex as number)}
        selectedIndex={itemIndex}
      />
    </Box>
  );
};

export const ScrollingWithBadges = () => {
  const [itemIndex, setItemIndex] = useState(0);
  return (
    <Box display="flex" width={300}>
      <SegmentedControl
        badges={[{count: 10}, {count: 5}, {count: 2}, {count: 15}, {count: 3, status: "error"}]}
        items={["Inbox", "Sent", "Drafts", "Archive", "Spam"]}
        maxItems={3}
        onChange={(activeIndex) => setItemIndex(activeIndex as number)}
        selectedIndex={itemIndex}
      />
    </Box>
  );
};
