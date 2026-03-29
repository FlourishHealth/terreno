import {
  AdminMCPChat,
  AdminModelTable,
  AdminScriptList,
  AdminVersionConfig,
} from "@terreno/admin-frontend";
import {useMCPTools, useTerrenoChat} from "@terreno/rtk";
import {useLocalSearchParams} from "expo-router";
import React from "react";
import {useReadProfile} from "@/hooks/useReadProfile";
import {terrenoApi} from "@/store/sdk";
import AIAdminScreen from "../AIAdminScreen";

const ADMIN_BASE_URL = "/admin";

const MCPChatScreen: React.FC = () => {
  const mcpTools = useMCPTools();
  const {messages, sendMessage, status} = useTerrenoChat({apiPath: "/api/chat"});

  return (
    <AdminMCPChat
      mcpTools={mcpTools}
      messages={messages}
      sendMessage={sendMessage}
      status={status}
    />
  );
};

const AdminTableScreen: React.FC = () => {
  const {model} = useLocalSearchParams<{model: string}>();
  const profile = useReadProfile();

  if (model === "__scripts") {
    return <AdminScriptList api={terrenoApi} baseUrl={ADMIN_BASE_URL} isAdmin={!!profile?.admin} />;
  }

  if (model === "version-config") {
    return <AdminVersionConfig api={terrenoApi} baseUrl={ADMIN_BASE_URL} />;
  }

  if (model === "ai-admin") {
    return <AIAdminScreen />;
  }

  if (model === "mcp-chat") {
    return <MCPChatScreen />;
  }

  return <AdminModelTable api={terrenoApi} baseUrl={ADMIN_BASE_URL} modelName={model} />;
};

export default AdminTableScreen;
