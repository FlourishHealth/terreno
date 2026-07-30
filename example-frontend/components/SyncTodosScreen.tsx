import {FlashList, type ListRenderItemInfo} from "@shopify/flash-list";
import {generateMutationId} from "@terreno/syncdb";
import {
  useConflicts,
  useEntity,
  useEntityIds,
  useMutate,
  useSyncStatus,
} from "@terreno/syncdb/react";
import {
  Box,
  Button,
  Card,
  CheckBox,
  ConflictSheet,
  Heading,
  IconButton,
  SyncStatusBanner,
  Text,
  TextField,
} from "@terreno/ui";
import {DateTime} from "luxon";
import type React from "react";
import {memo, useCallback, useMemo, useState} from "react";
import {SyncDevPanel} from "@/components/SyncDevPanel";
import {useSyncDbReady} from "@/hooks/useSyncDbReady";

/**
 * Shape of a todo in the local syncdb store. Server documents carry the full model
 * (toJSON); optimistic local creates carry exactly what the client wrote, which
 * includes _id because creates embed the client-minted id in the data.
 */
interface SyncTodo {
  _id: string;
  title?: string;
  completed?: boolean;
  created?: string;
}

/** Virtualized row: either a section heading or a todo id. */
type TodoListRow =
  | {type: "section"; key: string; title: string; count: number}
  | {type: "todo"; id: string};

const sortByCreatedDesc = (a: SyncTodo, b: SyncTodo): number => {
  // Optimistic creates have no server timestamp yet; float them to the top.
  const aMillis = a.created ? DateTime.fromISO(a.created).toMillis() : Number.MAX_SAFE_INTEGER;
  const bMillis = b.created ? DateTime.fromISO(b.created).toMillis() : Number.MAX_SAFE_INTEGER;
  return bMillis - aMillis;
};

const isIncomplete = (todo: SyncTodo): boolean => !todo.completed;
const isCompleted = (todo: SyncTodo): boolean => Boolean(todo.completed);

/**
 * One row. Subscribes to ONLY its own entity via useEntity, so a change to one
 * todo re-renders just that row — never the whole list. Memoized so a container
 * re-render (adds/removes elsewhere, sync activity) skips untouched rows.
 *
 * Title and completed are both mutable so multi-client races can conflict on
 * either field, or both at once.
 */
const SyncTodoItem: React.FC<{
  id: string;
  onToggle: (id: string, completed: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}> = memo(({id, onToggle, onRename, onDelete}) => {
  const {data} = useEntity<SyncTodo>("todos", id);
  const completed = Boolean(data?.completed);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draftTitle, setDraftTitle] = useState<string>("");

  const handleToggle = useCallback((): void => {
    onToggle(id, completed);
  }, [onToggle, id, completed]);

  const handleDelete = useCallback((): void => {
    onDelete(id);
  }, [onDelete, id]);

  const handleStartEdit = useCallback((): void => {
    setDraftTitle(data?.title ?? "");
    setIsEditing(true);
  }, [data?.title]);

  const commitTitle = useCallback(
    (value: string): void => {
      const nextTitle = value.trim();
      setIsEditing(false);
      if (!nextTitle || nextTitle === (data?.title ?? "")) {
        return;
      }
      onRename(id, nextTitle);
    },
    [data?.title, id, onRename]
  );

  const handleBlurEdit = useCallback(
    (value: string): void => {
      commitTitle(value);
    },
    [commitTitle]
  );

  const handleEnterEdit = useCallback((): void => {
    commitTitle(draftTitle);
  }, [commitTitle, draftTitle]);

  if (!data) {
    return null;
  }

  return (
    <Card marginBottom={2} testID={`todo-item-${id}`}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Box alignItems="center" direction="row" flex="grow" gap={2}>
          <Box onClick={handleToggle} testID={`todo-toggle-${id}`}>
            <CheckBox selected={completed} size="md" />
          </Box>
          {isEditing ? (
            <Box flex="grow">
              <TextField
                id={`todo-title-edit-${id}`}
                onBlur={handleBlurEdit}
                onChange={setDraftTitle}
                onEnter={handleEnterEdit}
                testID={`todo-title-input-${id}`}
                value={draftTitle}
              />
            </Box>
          ) : (
            <Box flex="grow" onClick={handleStartEdit} testID={`todo-title-${id}`}>
              <Text color={completed ? "secondaryLight" : "primary"} underline={completed}>
                {data.title ?? ""}
              </Text>
            </Box>
          )}
        </Box>
        <Box direction="row" gap={1}>
          {!isEditing && (
            <IconButton
              accessibilityLabel="Edit title"
              iconName="pen-to-square"
              onClick={handleStartEdit}
              testID={`todo-edit-${id}`}
              variant="muted"
            />
          )}
          <IconButton
            accessibilityLabel="Delete todo"
            iconName="trash"
            onClick={handleDelete}
            testID={`todo-delete-${id}`}
            variant="destructive"
          />
        </Box>
      </Box>
    </Card>
  );
});

SyncTodoItem.displayName = "SyncTodoItem";

/**
 * The create form owns its own input state so keystrokes re-render only this
 * small component — never the todo list.
 */
const NewTodoForm: React.FC<{disabled: boolean; onCreate: (title: string) => void}> = memo(
  ({disabled, onCreate}) => {
    const [newTodoTitle, setNewTodoTitle] = useState<string>("");

    const handleCreate = useCallback((): void => {
      const title = newTodoTitle.trim();
      if (!title) {
        return;
      }
      onCreate(title);
      setNewTodoTitle("");
    }, [newTodoTitle, onCreate]);

    return (
      <Card marginBottom={6}>
        <Box gap={3}>
          <TextField
            id="todo-new-input"
            onChange={setNewTodoTitle}
            onEnter={handleCreate}
            placeholder="What needs to be done?"
            testID="todos-title-input"
            title="New Todo"
            value={newTodoTitle}
          />
          <Button
            disabled={disabled || !newTodoTitle.trim()}
            fullWidth
            iconName="plus"
            onClick={handleCreate}
            testID="todos-create-button"
            text="Add Todo"
          />
        </Box>
      </Card>
    );
  }
);

NewTodoForm.displayName = "NewTodoForm";

const SectionHeader: React.FC<{title: string; count: number}> = memo(({title, count}) => (
  <Box marginBottom={3} marginTop={2}>
    <Heading size="lg">
      {title} ({count})
    </Heading>
  </Box>
));

SectionHeader.displayName = "SectionHeader";

/**
 * Local-first Todos screen backed by @terreno/syncdb. Reads come from the local store,
 * writes apply optimistically and sync through the durable outbox.
 *
 * Performance: a single FlashList virtualizes rows so Sync Lab volumes stay scrollable
 * on native. The list container still only re-renders when id membership/order changes
 * (`useEntityIds`); each row subscribes to its own entity via `useEntity`.
 */
const SyncTodosScreen: React.FC = () => {
  const isSyncDbReady = useSyncDbReady();
  const {create, update, remove} = useMutate("todos");
  const syncStatus = useSyncStatus();
  const {conflicts, resolve} = useConflicts();
  const [isConflictSheetVisible, setIsConflictSheetVisible] = useState<boolean>(false);

  const incompleteIds = useEntityIds<SyncTodo>("todos", {
    filter: isIncomplete,
    sort: sortByCreatedDesc,
  });
  const completedIds = useEntityIds<SyncTodo>("todos", {
    filter: isCompleted,
    sort: sortByCreatedDesc,
  });
  const totalCount = incompleteIds.length + completedIds.length;

  const listData = useMemo((): TodoListRow[] => {
    if (totalCount === 0) {
      return [];
    }
    const rows: TodoListRow[] = [
      {count: incompleteIds.length, key: "incomplete", title: "To Do", type: "section"},
      ...incompleteIds.map((id): TodoListRow => ({id, type: "todo"})),
    ];
    if (completedIds.length > 0) {
      rows.push({
        count: completedIds.length,
        key: "completed",
        title: "Completed",
        type: "section",
      });
      for (const id of completedIds) {
        rows.push({id, type: "todo"});
      }
    }
    return rows;
  }, [completedIds, incompleteIds, totalCount]);

  const handleCreate = useCallback(
    (title: string): void => {
      if (!isSyncDbReady) {
        return;
      }
      // Mint the entity id client-side and embed it in the data so the optimistic
      // local row is renderable/addressable before the server ever sees the document.
      const id = generateMutationId();
      create({data: {_id: id, completed: false, title}});
    },
    [create, isSyncDbReady]
  );

  const handleToggleTodo = useCallback(
    (id: string, completed: boolean): void => {
      if (!isSyncDbReady) {
        return;
      }
      update({data: {completed: !completed}, id});
    },
    [isSyncDbReady, update]
  );

  const handleRenameTodo = useCallback(
    (id: string, title: string): void => {
      if (!isSyncDbReady) {
        return;
      }
      update({data: {title}, id});
    },
    [isSyncDbReady, update]
  );

  const handleDeleteTodo = useCallback(
    (id: string): void => {
      if (!isSyncDbReady) {
        return;
      }
      remove({id});
    },
    [isSyncDbReady, remove]
  );

  const openConflictSheet = useCallback((): void => {
    setIsConflictSheetVisible(true);
  }, []);

  const closeConflictSheet = useCallback((): void => {
    setIsConflictSheetVisible(false);
  }, []);

  const keyExtractor = useCallback((item: TodoListRow): string => {
    if (item.type === "section") {
      return `section:${item.key}`;
    }
    return item.id;
  }, []);

  const getItemType = useCallback((item: TodoListRow): string => item.type, []);

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<TodoListRow>): React.ReactElement | null => {
      if (item.type === "section") {
        return <SectionHeader count={item.count} title={item.title} />;
      }
      return (
        <SyncTodoItem
          id={item.id}
          onDelete={handleDeleteTodo}
          onRename={handleRenameTodo}
          onToggle={handleToggleTodo}
        />
      );
    },
    [handleDeleteTodo, handleRenameTodo, handleToggleTodo]
  );

  const listHeader = useMemo(
    (): React.ReactElement => (
      <Box>
        <SyncStatusBanner
          conflictCount={syncStatus.conflictCount}
          isOnline={syncStatus.isOnline}
          isSyncing={syncStatus.isSyncing}
          onOpenConflicts={openConflictSheet}
          queuedCount={syncStatus.queuedCount}
        />
        <SyncDevPanel />
        <Box marginBottom={6}>
          <Heading size="xl">My Todos</Heading>
          <Text color="secondaryLight" size="sm">
            Local-first via @terreno/syncdb
          </Text>
          <Text color="secondaryLight" size="sm" testID="todos-count">
            {totalCount}
          </Text>
        </Box>
        <NewTodoForm disabled={!isSyncDbReady} onCreate={handleCreate} />
      </Box>
    ),
    [
      handleCreate,
      isSyncDbReady,
      openConflictSheet,
      syncStatus.conflictCount,
      syncStatus.isOnline,
      syncStatus.isSyncing,
      syncStatus.queuedCount,
      totalCount,
    ]
  );

  const listEmpty = useMemo(
    (): React.ReactElement => (
      <Text color="secondaryLight" testID="todos-empty-state">
        No todos yet. Add one above!
      </Text>
    ),
    []
  );

  return (
    <Box
      alignSelf="center"
      flex="grow"
      maxWidth={800}
      padding={4}
      style={{flex: 1}}
      testID="todos-screen"
      width="100%"
    >
      <ConflictSheet
        conflicts={conflicts}
        onDismiss={closeConflictSheet}
        onResolve={resolve}
        visible={isConflictSheetVisible}
      />
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        data={listData}
        getItemType={getItemType}
        keyboardShouldPersistTaps="handled"
        keyExtractor={keyExtractor}
        ListEmptyComponent={listEmpty}
        ListHeaderComponent={listHeader}
        renderItem={renderItem}
        style={{flex: 1}}
      />
    </Box>
  );
};

export default SyncTodosScreen;
