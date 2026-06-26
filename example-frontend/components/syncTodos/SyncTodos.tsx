import {
  type SyncDbClient,
  SyncDbProvider,
  useConflicts,
  useQuery,
  useSyncDbClient,
  useSyncMutations,
  useSyncStatus,
} from "@terreno/syncdb";
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
import {useCallback, useEffect, useMemo, useState} from "react";

import {getSyncDbClient} from "@/store/syncdb";

interface TodoData {
  title: string;
  completed: boolean;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `todo_${Date.now().toString(36)}`;
};

const SyncStatusBanner: React.FC = () => {
  const status = useSyncStatus();

  if (status.authBlocked) {
    return (
      <Card color="error" marginBottom={4}>
        <Text bold color="error" testID="app-sync-status-auth-blocked">
          Sign-in required to sync. Your changes are saved locally.
        </Text>
      </Card>
    );
  }

  const onlineText =
    status.queuedCount > 0
      ? `Online — ${status.queuedCount} change(s) pending sync`
      : "Online — all changes synced";
  const label = !status.isOnline
    ? {testID: "todos-sync-status-offline", text: "Offline — changes are queued locally"}
    : status.isSyncing
      ? {testID: "todos-sync-status-syncing", text: "Syncing queued changes…"}
      : {testID: "todos-sync-status-online", text: onlineText};

  return (
    <Card marginBottom={4}>
      <Box alignItems="center" direction="row" justifyContent="between">
        <Text testID={label.testID}>{label.text}</Text>
        <Badge status="info" testID="todos-sync-queue-count" value={status.queuedCount} />
      </Box>
    </Card>
  );
};

const ConflictBanner: React.FC = () => {
  const {conflicts, resolve} = useConflicts<TodoData>();

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Box marginBottom={4} testID="todos-conflict-banner">
      {conflicts.map((conflict) => (
        <Card
          color="error"
          key={conflict.conflictId}
          marginBottom={2}
          testID={`todos-conflict-card-${slugify(conflict.localData.title ?? conflict.entityId)}`}
        >
          <Box gap={2}>
            <Text bold color="error">
              Conflict on “{conflict.localData.title ?? conflict.entityId}”
            </Text>
            <Box direction="row" gap={2}>
              <Button
                onClick={() => resolve({conflictId: conflict.conflictId, strategy: "useServer"})}
                testID="todos-conflict-action-use-server"
                text="Use server"
                variant="muted"
              />
              <Button
                onClick={() => resolve({conflictId: conflict.conflictId, strategy: "keepMine"})}
                testID="todos-conflict-action-keep-mine"
                text="Keep mine"
              />
            </Box>
          </Box>
        </Card>
      ))}
    </Box>
  );
};

const SyncTodosScreen: React.FC = () => {
  const client = useSyncDbClient();
  const todos = useQuery<TodoData>({collection: "todos"});
  const {create, update, remove} = useSyncMutations<TodoData>({collection: "todos"});
  const [title, setTitle] = useState<string>("");
  const [error, setError] = useState<string | undefined>();
  const [isOnline, setIsOnline] = useState<boolean>(false);

  const handleSave = useCallback((): void => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError(undefined);
    create({data: {completed: false, title: title.trim()}, id: generateId()});
    setTitle("");
  }, [title, create]);

  const handleToggle = useCallback(
    (id: string, todo: TodoData): void => {
      update({data: {...todo, completed: !todo.completed}, id});
    },
    [update]
  );

  const handleDelete = useCallback(
    (id: string): void => {
      remove({id});
    },
    [remove]
  );

  const handleToggleConnectivity = useCallback(async (): Promise<void> => {
    if (isOnline) {
      client.disconnectSync();
      setIsOnline(false);
      return;
    }
    await client.connectSync();
    setIsOnline(true);
  }, [client, isOnline]);

  const handleRefresh = useCallback((): void => {
    client.replayOutbox();
  }, [client]);

  return (
    <Page navigation={undefined}>
      <Box padding={4} testID="todos-screen-root">
        <Box marginBottom={4}>
          <Heading size="xl">Local-First Todos</Heading>
        </Box>

        <SyncStatusBanner />
        <ConflictBanner />

        <Card marginBottom={6}>
          <Box gap={3}>
            <TextField
              onChange={setTitle}
              onEnter={handleSave}
              placeholder="What needs to be done?"
              testID="todos-input-title"
              title="New Todo"
              value={title}
            />
            {error ? (
              <Text color="error" testID="todos-error-title-required">
                {error}
              </Text>
            ) : null}
            <Box direction="row" gap={2}>
              <Button onClick={handleSave} testID="todos-button-save" text="Save" />
              <Button
                onClick={handleToggleConnectivity}
                text={isOnline ? "Go offline" : "Go online"}
                variant="outline"
              />
              <Button
                onClick={handleRefresh}
                testID="todos-button-refresh"
                text="Refresh"
                variant="muted"
              />
            </Box>
          </Box>
        </Card>

        {todos.length === 0 ? (
          <Text color="secondaryLight" testID="todos-empty-state">
            No todos yet. Add one above!
          </Text>
        ) : (
          todos.map((todo) => (
            <Card key={todo.id} marginBottom={2} testID={`todos-item-${slugify(todo.data.title)}`}>
              <Box alignItems="center" direction="row" justifyContent="between">
                <Box
                  alignItems="center"
                  direction="row"
                  flex="grow"
                  gap={3}
                  onClick={() => handleToggle(todo.id, todo.data)}
                >
                  <CheckBox selected={todo.data.completed} size="md" />
                  <Text underline={todo.data.completed}>{todo.data.title}</Text>
                </Box>
                <IconButton
                  accessibilityLabel="Delete todo"
                  iconName="trash"
                  onClick={() => handleDelete(todo.id)}
                  variant="destructive"
                />
              </Box>
            </Card>
          ))
        )}
      </Box>
    </Page>
  );
};

const SyncTodosGate: React.FC<{client: SyncDbClient}> = ({client}) => {
  const [ready, setReady] = useState<boolean>(false);

  // Initialize persistence (load any locally-stored todos) before rendering.
  useEffect(() => {
    let active = true;
    void client.start().then(() => {
      if (active) {
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [client]);

  if (!ready) {
    return (
      <Page navigation={undefined}>
        <Box alignItems="center" flex="grow" justifyContent="center">
          <Spinner />
        </Box>
      </Page>
    );
  }

  return (
    <SyncDbProvider client={client}>
      <SyncTodosScreen />
    </SyncDbProvider>
  );
};

/** Local-first todos screen rendered when the USE_SYNCDB flag is enabled. */
export const SyncTodos: React.FC = () => {
  const client = useMemo(() => getSyncDbClient(), []);
  return <SyncTodosGate client={client} />;
};
