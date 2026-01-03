import {Box, Button, Card, CheckBox, Heading, IconButton, Page, Spinner, Text, TextField} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";
import {Pressable, RefreshControl, ScrollView} from "react-native";
import {
  type Todo,
  useDeleteTodosByIdMutation,
  useGetTodosQuery,
  usePatchTodosByIdMutation,
  usePostTodosMutation,
} from "@/store";

const TodoItem: React.FC<{
  todo: Todo;
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}> = ({todo, onToggle, onDelete}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const handleToggle = useCallback(async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await onToggle(todo.id, !todo.completed);
    } finally {
      setIsUpdating(false);
    }
  }, [todo.id, todo.completed, onToggle]);

  const handleDelete = useCallback(async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await onDelete(todo.id);
    } finally {
      setIsUpdating(false);
    }
  }, [todo.id, onDelete]);

  return (
    <Card marginBottom={2}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Pressable
          disabled={isUpdating}
          onPress={handleToggle}
          style={{alignItems: "center", flex: 1, flexDirection: "row"}}
        >
          <Box marginRight={3}>
            <CheckBox selected={todo.completed} size="md" />
          </Box>
          <Box flex="grow">
            <Text color={todo.completed ? "secondaryLight" : "primary"} underline={todo.completed}>
              {todo.title}
            </Text>
          </Box>
        </Pressable>
        <IconButton
          disabled={isUpdating}
          iconName="trash"
          onClick={handleDelete}
          variant="destructive"
        />
      </Box>
    </Card>
  );
};

const TodosScreen: React.FC = () => {
  const [newTodoTitle, setNewTodoTitle] = useState<string>("");
  const [showCompleted, setShowCompleted] = useState<boolean>(true);

  const {data: todosData, isLoading, refetch, isFetching} = useGetTodosQuery({});
  const [createTodo, {isLoading: isCreating}] = usePostTodosMutation();
  const [updateTodo] = usePatchTodosByIdMutation();
  const [deleteTodo] = useDeleteTodosByIdMutation();

  const todos = todosData?.data ?? [];
  const incompleteTodos = todos.filter((todo) => !todo.completed);
  const completedTodos = todos.filter((todo) => todo.completed);

  const handleCreateTodo = useCallback(async (): Promise<void> => {
    if (!newTodoTitle.trim()) {
      return;
    }

    try {
      await createTodo({body: {title: newTodoTitle.trim()}}).unwrap();
      setNewTodoTitle("");
    } catch (err) {
      console.error("Error creating todo:", err);
    }
  }, [newTodoTitle, createTodo]);

  const handleToggleTodo = useCallback(
    async (id: string, completed: boolean): Promise<void> => {
      try {
        await updateTodo({body: {completed}, id}).unwrap();
      } catch (err) {
        console.error("Error updating todo:", err);
      }
    },
    [updateTodo]
  );

  const handleDeleteTodo = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteTodo({id}).unwrap();
      } catch (err) {
        console.error("Error deleting todo:", err);
      }
    },
    [deleteTodo]
  );

  const handleRefresh = useCallback((): void => {
    refetch();
  }, [refetch]);

  const toggleShowCompleted = useCallback((): void => {
    setShowCompleted(!showCompleted);
  }, [showCompleted]);

  if (isLoading) {
    return (
      <Page navigation={undefined}>
        <Box alignItems="center" flex="grow" justifyContent="center">
          <Spinner />
        </Box>
      </Page>
    );
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={isFetching} />}
      style={{flex: 1}}
    >
      <Page navigation={undefined} scroll={false}>
        <Box padding={4}>
          <Box marginBottom={6}>
            <Heading size="xl">My Todos</Heading>
          </Box>

          {/* Add new todo */}
          <Card marginBottom={6}>
            <Box gap={3}>
              <TextField
                disabled={isCreating}
                onChange={setNewTodoTitle}
                onEnter={handleCreateTodo}
                placeholder="What needs to be done?"
                title="New Todo"
                value={newTodoTitle}
              />
              <Button
                disabled={!newTodoTitle.trim() || isCreating}
                fullWidth
                iconName="plus"
                loading={isCreating}
                onClick={handleCreateTodo}
                text="Add Todo"
              />
            </Box>
          </Card>

          {/* Incomplete todos */}
          <Box marginBottom={4}>
            <Box marginBottom={3}>
              <Heading size="lg">To Do ({incompleteTodos.length})</Heading>
            </Box>
            {incompleteTodos.length === 0 ? (
              <Text color="secondaryLight">No todos yet. Add one above!</Text>
            ) : (
              incompleteTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
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
              <Pressable onPress={toggleShowCompleted}>
                <Box alignItems="center" direction="row" marginBottom={3}>
                  <Heading size="lg">Completed ({completedTodos.length})</Heading>
                  <Box marginLeft={2}>
                    <Text color="secondaryLight">{showCompleted ? "▼" : "▶"}</Text>
                  </Box>
                </Box>
              </Pressable>
              {showCompleted &&
                completedTodos.map((todo) => (
                  <TodoItem
                    key={todo.id}
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

export default TodosScreen;
