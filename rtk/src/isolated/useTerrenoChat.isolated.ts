import {beforeEach, describe, expect, it, mock} from "bun:test";

interface TransportOptions {
  api: string;
  headers: () => Promise<Record<string, string>>;
}

interface ChatOptions {
  id?: string;
  onError?: (error: Error) => void;
  transport: MockDefaultChatTransport;
}

let authToken: string | null = "test-token";
const transports: MockDefaultChatTransport[] = [];
const chatOptions: ChatOptions[] = [];

class MockDefaultChatTransport {
  public readonly options: TransportOptions;

  public constructor(options: TransportOptions) {
    this.options = options;
    transports.push(this);
  }
}

const chatResult = {messages: [], status: "ready"};

mock.module("@ai-sdk/react", () => ({
  useChat: (options: ChatOptions) => {
    chatOptions.push(options);
    return chatResult;
  },
}));
mock.module("ai", () => ({
  DefaultChatTransport: MockDefaultChatTransport,
}));
mock.module("../authSlice", () => ({
  getAuthToken: async (): Promise<string | null> => authToken,
}));
mock.module("../constants", () => ({
  baseUrl: "https://api.example.com",
}));

const {useTerrenoChat} = await import("../useTerrenoChat");

beforeEach(() => {
  authToken = "test-token";
  transports.length = 0;
  chatOptions.length = 0;
});

describe("useTerrenoChat", () => {
  it("defaults to the resolved base url and chat path", () => {
    const result = useTerrenoChat();

    expect(transports[0]?.options.api).toBe("https://api.example.com/api/chat");
    expect(chatOptions[0]?.id).toBeUndefined();
    expect(chatOptions[0]?.onError).toBeUndefined();
    expect(result).toBe(chatResult);
  });

  it("uses the provided base url and api path", () => {
    useTerrenoChat({apiPath: "/chat/stream", baseURL: "https://chat.example.com"});

    expect(transports[0]?.options.api).toBe("https://chat.example.com/chat/stream");
  });

  it("forwards the chat id and error handler to useChat", () => {
    const onError = mock((_error: Error) => {});

    useTerrenoChat({id: "chat-1", onError});

    expect(chatOptions[0]?.id).toBe("chat-1");
    expect(chatOptions[0]?.onError).toBe(onError);
  });

  it("injects a bearer token header when a token is available", async () => {
    useTerrenoChat();

    await expect(transports[0]?.options.headers()).resolves.toEqual({
      Authorization: "Bearer test-token",
    });
  });

  it("omits the authorization header when no token is available", async () => {
    authToken = null;
    useTerrenoChat();

    await expect(transports[0]?.options.headers()).resolves.toEqual({});
  });
});
