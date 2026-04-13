import {useFeatureFlags} from "@terreno/rtk";
import {
  Badge,
  Box,
  Button,
  Card,
  CheckBox,
  Heading,
  IconButton,
  Page,
  Spinner,
  Text,
  TextField,
} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";
import {RefreshControl, ScrollView} from "react-native";
import {
  type Todo,
  terrenoApi,
  useDeleteTodosByIdMutation,
  useGetTodosQuery,
  usePatchTodosByIdMutation,
  usePostTodosMutation,
} from "@/store";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TodoItem: React.FC<TodoItemProps> = ({todo, onToggle, onDelete}) => {
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
    <Card marginBottom={2} testID={`todos-item-${todo.id}`}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Box
          alignItems="center"
          direction="row"
          flex="grow"
          onClick={isUpdating ? undefined : handleToggle}
          testID={`todos-toggle-${todo.id}`}
        >
          <Box marginRight={3}>
            <CheckBox selected={todo.completed} size="md" />
          </Box>
          <Box flex="grow">
            <Text color={todo.completed ? "secondaryLight" : "primary"} underline={todo.completed}>
              {todo.title}
            </Text>
          </Box>
        </Box>
        <IconButton
          accessibilityLabel="Delete todo"
          disabled={isUpdating}
          iconName="trash"
          onClick={handleDelete}
          testID={`todos-delete-${todo.id}`}
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

  const {getFlag} = useFeatureFlags(terrenoApi);
  const showSummaryCard = getFlag("todo-summary-card");

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
        const todo = todos.find((t) => t.id === id);
        await updateTodo({body: {completed, title: todo?.title ?? ""}, id}).unwrap();
      } catch (err) {
        console.error("Error updating todo:", err);
      }
    },
    [updateTodo, todos]
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
    setShowCompleted((previousValue) => !previousValue);
  }, []);

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
      testID="todos-screen"
    >
      <Page navigation={undefined} scroll={false}>
        <Box padding={4}>
          <Box marginBottom={6}>
            <Heading size="xl">My Todos</Heading>
          </Box>

          {/* Summary card — gated by "todo-summary-card" feature flag */}
          {showSummaryCard && (
            <Card marginBottom={4} testID="todos-summary-card">
              <Box alignItems="center" direction="row" gap={3}>
                <Badge status="warning" value={incompleteTodos.length} />
                <Text size="sm">remaining</Text>
                <Badge status="success" value={completedTodos.length} />
                <Text size="sm">completed</Text>
                <Badge status="info" value={todos.length} />
                <Text size="sm">total</Text>
              </Box>
            </Card>
          )}

          {/* Add new todo */}
          <Card marginBottom={6}>
            <Box gap={3}>
              <TextField
                disabled={isCreating}
                id="todo-new-input"
                onChange={setNewTodoTitle}
                onEnter={handleCreateTodo}
                placeholder="What needs to be done?"
                testID="todos-new-title-input"
                title="New Todo"
                value={newTodoTitle}
              />
              <Button
                disabled={!newTodoTitle.trim() || isCreating}
                fullWidth
                iconName="plus"
                loading={isCreating}
                onClick={handleCreateTodo}
                testID="todos-add-button"
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
              <Text color="secondaryLight" testID="todos-empty-text">
                No todos yet. Add one above!
              </Text>
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
              <Box
                alignItems="center"
                direction="row"
                marginBottom={3}
                onClick={toggleShowCompleted}
                testID="todos-completed-section-toggle"
              >
                <Heading size="lg">Completed ({completedTodos.length})</Heading>
                <Box marginLeft={2}>
                  <Text color="secondaryLight">{showCompleted ? "▼" : "▶"}</Text>
                </Box>
              </Box>
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
