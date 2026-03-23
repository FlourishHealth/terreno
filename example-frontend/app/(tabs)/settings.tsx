import {
  BooleanField,
  Box,
  Button,
  Card,
  Heading,
  IconButton,
  Page,
  Spinner,
  Text,
  TextField,
} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";
import {
  type McpServer,
  useDeleteMcpServersByIdMutation,
  useGetMcpServersQuery,
  usePatchMcpServersByIdMutation,
  usePostMcpServersMutation,
} from "@/store";

interface McpServerItemProps {
  server: McpServer;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const McpServerItem: React.FC<McpServerItemProps> = ({server, onToggle, onDelete}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const handleToggle = useCallback(async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await onToggle(server.id, !server.enabled);
    } finally {
      setIsUpdating(false);
    }
  }, [server.id, server.enabled, onToggle]);

  const handleDelete = useCallback(async (): Promise<void> => {
    setIsUpdating(true);
    try {
      await onDelete(server.id);
    } finally {
      setIsUpdating(false);
    }
  }, [server.id, onDelete]);

  return (
    <Card marginBottom={2}>
      <Box gap={2}>
        <Box alignItems="center" direction="row" justifyContent="between">
          <Box flex="grow">
            <Text bold color={server.enabled ? "primary" : "secondaryLight"}>
              {server.name}
            </Text>
            <Text color="secondaryLight" size="sm">
              {server.url}
            </Text>
          </Box>
          <Box alignItems="center" direction="row" gap={2}>
            <BooleanField disabled={isUpdating} onChange={handleToggle} value={server.enabled} />
            <IconButton
              disabled={isUpdating}
              iconName="trash"
              onClick={handleDelete}
              variant="destructive"
            />
          </Box>
        </Box>
      </Box>
    </Card>
  );
};

const SettingsScreen: React.FC = () => {
  const [serverName, setServerName] = useState<string>("");
  const [serverUrl, setServerUrl] = useState<string>("");
  const [serverApiKey, setServerApiKey] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const {data: serversData, isLoading} = useGetMcpServersQuery({});
  const [createServer, {isLoading: isCreating}] = usePostMcpServersMutation();
  const [updateServer] = usePatchMcpServersByIdMutation();
  const [deleteServer] = useDeleteMcpServersByIdMutation();

  const servers = serversData?.data ?? [];

  const handleAddServer = useCallback(async (): Promise<void> => {
    if (!serverName.trim() || !serverUrl.trim()) {
      return;
    }

    try {
      const body: {name: string; url: string; apiKey?: string} = {
        name: serverName.trim(),
        url: serverUrl.trim(),
      };
      if (serverApiKey.trim()) {
        body.apiKey = serverApiKey.trim();
      }
      await createServer({body}).unwrap();
      setServerName("");
      setServerUrl("");
      setServerApiKey("");
      setIsAdding(false);
    } catch (err) {
      console.error("Error adding MCP server:", err);
    }
  }, [serverName, serverUrl, serverApiKey, createServer]);

  const handleToggleServer = useCallback(
    async (id: string, enabled: boolean): Promise<void> => {
      try {
        await updateServer({body: {enabled}, id}).unwrap();
      } catch (err) {
        console.error("Error updating MCP server:", err);
      }
    },
    [updateServer]
  );

  const handleDeleteServer = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteServer({id}).unwrap();
      } catch (err) {
        console.error("Error deleting MCP server:", err);
      }
    },
    [deleteServer]
  );

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
    <Page navigation={undefined} scroll>
      <Box padding={4}>
        <Box marginBottom={6}>
          <Heading size="xl">Settings</Heading>
        </Box>

        <Card marginBottom={6}>
          <Box gap={4}>
            <Box alignItems="center" direction="row" justifyContent="between">
              <Heading size="lg">MCP Servers</Heading>
              {!isAdding && (
                <Button
                  iconName="plus"
                  onClick={() => setIsAdding(true)}
                  text="Add Server"
                  variant="secondary"
                />
              )}
            </Box>

            <Text color="secondaryLight">
              Configure Model Context Protocol servers to connect AI tools to your application.
            </Text>

            {isAdding && (
              <Card color="base">
                <Box gap={3}>
                  <TextField
                    disabled={isCreating}
                    onChange={setServerName}
                    placeholder="My MCP Server"
                    title="Name"
                    value={serverName}
                  />
                  <TextField
                    disabled={isCreating}
                    onChange={setServerUrl}
                    placeholder="https://mcp.example.com/mcp"
                    title="URL"
                    type="url"
                    value={serverUrl}
                  />
                  <TextField
                    disabled={isCreating}
                    onChange={setServerApiKey}
                    placeholder="Optional"
                    title="API Key"
                    type="password"
                    value={serverApiKey}
                  />
                  <Box direction="row" gap={2}>
                    <Button
                      disabled={!serverName.trim() || !serverUrl.trim() || isCreating}
                      iconName="check"
                      loading={isCreating}
                      onClick={handleAddServer}
                      text="Save"
                    />
                    <Button
                      disabled={isCreating}
                      onClick={() => {
                        setIsAdding(false);
                        setServerName("");
                        setServerUrl("");
                        setServerApiKey("");
                      }}
                      text="Cancel"
                      variant="secondary"
                    />
                  </Box>
                </Box>
              </Card>
            )}

            {servers.length === 0 && !isAdding ? (
              <Text color="secondaryLight">No MCP servers configured. Add one to get started.</Text>
            ) : (
              servers.map((server) => (
                <McpServerItem
                  key={server.id}
                  onDelete={handleDeleteServer}
                  onToggle={handleToggleServer}
                  server={server}
                />
              ))
            )}
          </Box>
        </Card>
      </Box>
    </Page>
  );
};

export default SettingsScreen;
