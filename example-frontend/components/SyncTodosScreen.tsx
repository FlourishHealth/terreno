import {generateMutationId} from "@terreno/syncdb";
import {useMutate, useQuery, useSyncDbClient} from "@terreno/syncdb/react";
import {Box, Button, Card, CheckBox, Heading, IconButton, Page, Text, TextField} from "@terreno/ui";
import {DateTime} from "luxon";
import type React from "react";
import {useCallback, useState} from "react";
import {ScrollView} from "react-native";
import {ConflictSheet} from "@/components/ConflictSheet";
import {SyncDevPanel} from "@/components/SyncDevPanel";
import {SyncStatusBanner} from "@/components/SyncStatusBanner";

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

const sortByCreatedDesc = (a: SyncTodo, b: SyncTodo): number => {
  // Optimistic creates have no server timestamp yet; float them to the top.
  const aMillis = a.created ? DateTime.fromISO(a.created).toMillis() : Number.MAX_SAFE_INTEGER;
  const bMillis = b.created ? DateTime.fromISO(b.created).toMillis() : Number.MAX_SAFE_INTEGER;
  return bMillis - aMillis;
};

const SyncTodoItem: React.FC<{
  todo: SyncTodo;
  onToggle: (todo: SyncTodo) => void;
  onDelete: (todo: SyncTodo) => void;
}> = ({todo, onToggle, onDelete}) => {
  const handleToggle = useCallback((): void => {
    onToggle(todo);
  }, [onToggle, todo]);

  const handleDelete = useCallback((): void => {
    onDelete(todo);
  }, [onDelete, todo]);

  return (
    <Card marginBottom={2} testID={`todo-item-${todo._id}`}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Box
          alignItems="center"
          direction="row"
          flex="grow"
          onClick={handleToggle}
          testID={`todo-toggle-${todo._id}`}
        >
          <Box marginRight={3}>
            <CheckBox selected={Boolean(todo.completed)} size="md" />
          </Box>
          <Text color={todo.completed ? "secondaryLight" : "primary"} underline={todo.completed}>
            {todo.title ?? ""}
          </Text>
        </Box>
        <IconButton
          accessibilityLabel="Delete todo"
          iconName="trash"
          onClick={handleDelete}
          testID={`todo-delete-${todo._id}`}
          variant="destructive"
        />
      </Box>
    </Card>
  );
};

/**
 * Local-first Todos screen backed by @terreno/syncdb (rendered when the USE_SYNCDB
 * flag is on). Reads come from the local store, writes apply optimistically and sync
 * through the durable outbox; the RTK implementation is untouched behind the flag.
 */
const SyncTodosScreen: React.FC = () => {
  const client = useSyncDbClient();
  const [newTodoTitle, setNewTodoTitle] = useState<string>("");
  const [isConflictSheetVisible, setIsConflictSheetVisible] = useState<boolean>(false);

  const todos = useQuery<SyncTodo>("todos", {sort: sortByCreatedDesc});
  const {update, remove} = useMutate("todos");

  const incompleteTodos = todos.filter((todo) => !todo.completed);
  const completedTodos = todos.filter((todo) => Boolean(todo.completed));

  const handleCreateTodo = useCallback((): void => {
    const title = newTodoTitle.trim();
    if (!title) {
      return;
    }
    // Mint the entity id client-side and embed it in the data so the optimistic local
    // row is renderable/addressable before the server ever sees the document.
    const id = generateMutationId();
    client.mutate({
      collection: "todos",
      data: {_id: id, completed: false, title},
      id,
      operation: "create",
    });
    setNewTodoTitle("");
  }, [client, newTodoTitle]);

  const handleToggleTodo = useCallback(
    (todo: SyncTodo): void => {
      update({data: {completed: !todo.completed}, id: todo._id});
    },
    [update]
  );

  const handleDeleteTodo = useCallback(
    (todo: SyncTodo): void => {
      remove({id: todo._id});
    },
    [remove]
  );

  const openConflictSheet = useCallback((): void => {
    setIsConflictSheetVisible(true);
  }, []);

  const closeConflictSheet = useCallback((): void => {
    setIsConflictSheetVisible(false);
  }, []);

  return (
    <ScrollView style={{flex: 1}} testID="todos-screen">
      <Page navigation={undefined} scroll={false}>
        <Box padding={4}>
          <SyncStatusBanner onOpenConflicts={openConflictSheet} />
          <SyncDevPanel />
          <ConflictSheet onDismiss={closeConflictSheet} visible={isConflictSheetVisible} />

          <Box marginBottom={6}>
            <Heading size="xl">My Todos</Heading>
            <Text color="secondaryLight" size="sm">
              Local-first via @terreno/syncdb
            </Text>
          </Box>

          {/* Add new todo */}
          <Card marginBottom={6}>
            <Box gap={3}>
              <TextField
                id="todo-new-input"
                onChange={setNewTodoTitle}
                onEnter={handleCreateTodo}
                placeholder="What needs to be done?"
                testID="todos-title-input"
                title="New Todo"
                value={newTodoTitle}
              />
              <Button
                disabled={!newTodoTitle.trim()}
                fullWidth
                iconName="plus"
                onClick={handleCreateTodo}
                testID="todos-create-button"
                text="Add Todo"
              />
            </Box>
          </Card>

          {/* Incomplete todos */}
          <Box marginBottom={4}>
            <Box marginBottom={3}>
              <Heading size="lg">To Do ({incompleteTodos.length})</Heading>
            </Box>
            {todos.length === 0 ? (
              <Text color="secondaryLight" testID="todos-empty-state">
                No todos yet. Add one above!
              </Text>
            ) : (
              incompleteTodos.map((todo) => (
                <SyncTodoItem
                  key={todo._id}
                  onDelete={handleDeleteTodo}
                  onToggle={handleToggleTodo}
                  todo={todo}
                />
              ))
            )}
          </Box>

          {/* Completed todos */}
          {completedTodos.length > 0 && (
            <Box>
              <Box marginBottom={3}>
                <Heading size="lg">Completed ({completedTodos.length})</Heading>
              </Box>
              {completedTodos.map((todo) => (
                <SyncTodoItem
                  key={todo._id}
                  onDelete={handleDeleteTodo}
                  onToggle={handleToggleTodo}
                  todo={todo}
                />
              ))}
            </Box>
          )}
        </Box>
      </Page>
    </ScrollView>
  );
};

export default SyncTodosScreen;
