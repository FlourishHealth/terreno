import {Box, Button, FlatList, Heading, SideDrawer, Text} from "ferns-ui";
import {useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

interface DrawerStoryProps {
  position: "right" | "left";
}

export const DrawerStory = ({position}: DrawerStoryProps) => {
  const [open, setOpen] = useState(false);

  const users = Array.from(Array(100).keys()).map((i) => ({
    id: i,
    name: `user${i}`,
  }));

  return (
    <SideDrawer
      isOpen={open}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      position={position}
      renderContent={() => (
        <Box height="100%">
          <Box>
            <Heading>Drawer Heading</Heading>
          </Box>
          <FlatList
            data={users}
            renderItem={(item) => (
              <Box>
                <Text>{item.item.name}</Text>
              </Box>
            )}
          />
        </Box>
      )}
    >
      <StorybookContainer>
        <Button
          onClick={() => {
            setOpen((prevOpen) => !prevOpen);
          }}
          text="Open drawer"
        />
      </StorybookContainer>
    </SideDrawer>
  );
};
