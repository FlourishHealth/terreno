import {useChat} from "@ai-sdk/react";
import {DefaultChatTransport} from "ai";

import {getAuthToken} from "./authSlice";
import {baseUrl} from "./constants";

export interface UseTerrenoChatOptions {
  /** Base URL of the Terreno backend. Defaults to the resolved baseUrl from constants. */
  baseURL?: string;
  /** Override the chat API endpoint path. Defaults to "/api/chat". */
  apiPath?: string;
  /** Chat ID for session management. */
  id?: string;
  /** Callback when an error occurs. */
  onError?: (error: Error) => void;
}

/**
 * Hook that wraps @ai-sdk/react's useChat() pre-configured for a Terreno MCP backend.
 * Automatically injects Bearer token from auth state.
 *
 * The backend needs a chat endpoint (e.g. POST /api/chat) that accepts messages
 * and returns a streaming response. The MCP tools are available server-side via getMCPTools().
 */
export const useTerrenoChat = (options: UseTerrenoChatOptions = {}) => {
  const {baseURL = baseUrl, apiPath = "/api/chat", id, onError} = options;

  const chatResult = useChat({
    id,
    onError,
    transport: new DefaultChatTransport({
      api: `${baseURL}${apiPath}`,
      headers: async () => {
        const token = await getAuthToken();
        const result: Record<string, string> = {};
        if (token) {
          result.Authorization = `Bearer ${token}`;
        }
        return result;
      },
    }),
  });

  return chatResult;
};
