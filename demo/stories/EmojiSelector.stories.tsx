import {Box, EmojiSelector, Text} from "ferns-ui";
import {type ReactElement, useState} from "react";

export const EmojiSelectorDemo = (): ReactElement => {
  const [selected, setSelected] = useState("");

  return (
    <Box direction="column" display="flex" gap={2} height="100%" maxWidth={500} padding={2}>
      <Box
        alignItems="center"
        color="neutralLight"
        direction="row"
        display="flex"
        gap={2}
        justifyContent="center"
        padding={2}
        rounding="md"
      >
        <Text bold>Selected emoji:</Text>
        {selected ? <Text size="2xl">{selected}</Text> : <Text color="secondaryLight">None</Text>}
      </Box>
      <Box flex="grow" minHeight={0} overflow="hidden" rounding="md">
        <EmojiSelector
          category={EmojiSelector.defaultProps.category}
          columns={EmojiSelector.defaultProps.columns}
          onEmojiSelected={setSelected}
          placeholder={EmojiSelector.defaultProps.placeholder}
          showHistory={false}
          showSearchBar
          showSectionTitles
          showTabs
          theme={EmojiSelector.defaultProps.theme}
        />
      </Box>
    </Box>
  );
};
