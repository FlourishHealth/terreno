import * as Clipboard from "expo-clipboard";
import {DateTime} from "luxon";

export const formatMcpTimestamp = (value?: string | null): string => {
  if (!value) {
    return "—";
  }
  const parsed = DateTime.fromISO(value);
  if (!parsed.isValid) {
    return "—";
  }
  return parsed.toLocaleString(DateTime.DATETIME_SHORT);
};

export const buildMcpClientSnippet = (mcpUrl: string, token: string): string => {
  return JSON.stringify(
    {
      mcpServers: {
        "my-app": {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          url: mcpUrl,
        },
      },
    },
    null,
    2
  );
};

export const copyMcpText = async (value: string): Promise<void> => {
  await Clipboard.setStringAsync(value);
};

export const issuedTokenFromCreateResult = (result: {
  data?: {mcpUrl?: string; token?: string};
  mcpUrl?: string;
  token?: string;
}): {mcpUrl: string; token: string} | null => {
  const token = result.token ?? result.data?.token;
  const mcpUrl = result.mcpUrl ?? result.data?.mcpUrl;
  if (!token || !mcpUrl) {
    return null;
  }
  return {mcpUrl, token};
};
