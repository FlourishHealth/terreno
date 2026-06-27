import {useQuery, useSyncMutations} from "@terreno/syncdb";
import {Box, IconButton, Text, TextField} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

import {generateId, slugify} from "./ids";

export interface TodoListData {
  name: string;
  color?: string;
}

interface ListChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}

const ListChip: React.FC<ListChipProps> = ({label, selected, onPress, testID}) => {
  return (
    <Box
      color={selected ? "primary" : "neutralLight"}
      onClick={onPress}
      paddingX={3}
      paddingY={2}
      rounding="lg"
      testID={testID}
    >
      <Text color={selected ? "inverted" : "primary"} size="sm">
        {label}
      </Text>
    </Box>
  );
};

/**
 * Local-first list selector backed by the `todoLists` collection. Lets the user
 * create lists, pick the active one (to filter and tag todos), and delete it —
 * all via syncdb hooks, demonstrating a second synced collection alongside todos.
 */
export const ListsBar: React.FC<{
  selectedListId: string | null;
  onSelect: (listId: string | null) => void;
}> = ({selectedListId, onSelect}) => {
  const lists = useQuery<TodoListData>({collection: "todoLists"});
  const {create, remove} = useSyncMutations<TodoListData>({collection: "todoLists"});
  const [name, setName] = useState<string>("");

  const handleAdd = useCallback((): void => {
    if (!name.trim()) {
      return;
    }
    const id = generateId();
    create({data: {name: name.trim()}, id});
    setName("");
    onSelect(id);
  }, [name, create, onSelect]);

  const handleDeleteSelected = useCallback((): void => {
    if (!selectedListId) {
      return;
    }
    remove({id: selectedListId});
    onSelect(null);
  }, [remove, selectedListId, onSelect]);

  return (
    <Box gap={2} marginBottom={4} testID="lists-bar">
      <Box alignItems="center" direction="row" gap={2} wrap>
        <ListChip
          label="All"
          onPress={() => onSelect(null)}
          selected={selectedListId === null}
          testID="lists-chip-all"
        />
        {lists.map((list) => (
          <ListChip
            key={list.id}
            label={list.data.name}
            onPress={() => onSelect(list.id)}
            selected={selectedListId === list.id}
            testID={`lists-chip-${slugify(list.data.name)}`}
          />
        ))}
        {selectedListId ? (
          <IconButton
            accessibilityLabel="Delete list"
            iconName="trash"
            onClick={handleDeleteSelected}
            testID="lists-button-delete"
            variant="destructive"
          />
        ) : null}
      </Box>
      <Box alignItems="end" direction="row" gap={2}>
        <Box flex="grow">
          <TextField
            onChange={setName}
            onEnter={handleAdd}
            placeholder="New list name"
            testID="lists-input-name"
            value={name}
          />
        </Box>
        <IconButton
          accessibilityLabel="Add list"
          iconName="plus"
          onClick={handleAdd}
          testID="lists-button-add"
          variant="primary"
        />
      </Box>
    </Box>
  );
};
