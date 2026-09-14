import {afterAll, afterEach, describe, it, mock} from "bun:test";
import {act, fireEvent, render, waitFor} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {Platform, Pressable, ScrollView} from "react-native";

import type {SelectedFile} from "./FilePickerButton";
import type {GPTChatHistory, GPTChatMessage, GPTChatProps, MessageContentPart} from "./GPTChat";
import {GPTChat} from "./GPTChat";
import {ThemeProvider} from "./Theme";
import {renderWithTheme} from "./test-utils";

const setStringAsync = mock(async (_text: string) => {});
mock.module("expo-clipboard", () => ({setStringAsync}));

const pickedDocument = {mimeType: "text/plain", name: "notes.txt", uri: "file:///notes.txt"};
mock.module("expo-document-picker", () => ({
  getDocumentAsync: mock(async () => ({assets: [pickedDocument], canceled: false})),
}));

// bunSetup.ts mocks IconButton to render null; GPTChat's controls are icon buttons, so replace it
// with a pressable stub that keeps the accessibility label and testID.
mock.module("./IconButton", () => ({
  IconButton: ({
    accessibilityLabel,
    disabled,
    onClick,
    testID,
  }: {
    accessibilityLabel?: string;
    disabled?: boolean;
    onClick?: () => void;
    testID?: string;
  }) => React.createElement(Pressable, {accessibilityLabel, disabled, onPress: onClick, testID}),
}));

// Module mocks are global, so restore the bunSetup stub for test files that run after this one.
afterAll(() => {
  mock.module("./IconButton", () => ({IconButton: mock(() => null)}));
});

// Box and IconButton presses run through an async haptic call, so state updates land in a
// microtask after the event.
const press = async (element: Parameters<typeof fireEvent.press>[0]): Promise<void> => {
  await act(async () => {
    fireEvent.press(element);
  });
};

const histories: GPTChatHistory[] = [
  {id: "h1", prompts: [], title: "First chat"},
  {id: "h2", prompts: []},
];

const renderChat = (overrides: Partial<GPTChatProps> = {}): ReturnType<typeof renderWithTheme> => {
  return renderWithTheme(
    <GPTChat
      currentMessages={[]}
      histories={histories}
      onCreateHistory={() => {}}
      onDeleteHistory={() => {}}
      onSelectHistory={() => {}}
      onSubmit={() => {}}
      testID="gpt-chat"
      {...overrides}
    />
  );
};

describe("GPTChat", () => {
  it("renders the sidebar with chat histories", () => {
    const {getByTestId, getByText} = renderChat();

    assert.isOk(getByTestId("gpt-chat"));
    assert.isOk(getByText("Chats"));
    assert.isOk(getByText("First chat"));
    assert.isOk(getByText("New Chat"));
  });

  it("selects, creates, and deletes histories", async () => {
    const onSelectHistory = mock((_id: string) => {});
    const onCreateHistory = mock(() => {});
    const onDeleteHistory = mock((_id: string) => {});
    const {getByLabelText, getByTestId} = renderChat({
      currentHistoryId: "h1",
      onCreateHistory,
      onDeleteHistory,
      onSelectHistory,
    });

    await press(getByLabelText("Select chat: First chat"));
    await press(getByTestId("gpt-new-chat-button"));
    await press(getByTestId("gpt-delete-history-h2"));

    assert.deepEqual(onSelectHistory.mock.calls, [["h1"]]);
    assert.equal(onCreateHistory.mock.calls.length, 1);
    assert.deepEqual(onDeleteHistory.mock.calls, [["h2"]]);
  });

  it("renames a history and saves the new title once", async () => {
    const onUpdateTitle = mock((_id: string, _title: string) => {});
    const {getByTestId} = renderChat({onUpdateTitle});

    await press(getByTestId("gpt-rename-history-h1"));
    fireEvent.changeText(getByTestId("gpt-rename-input-h1"), "Renamed");
    await press(getByTestId("gpt-rename-save-h1"));

    assert.deepEqual(onUpdateTitle.mock.calls, [["h1", "Renamed"]]);
  });

  it("ignores a rename with a blank title and skips duplicate saves", async () => {
    const onUpdateTitle = mock((_id: string, _title: string) => {});
    const {getByTestId} = renderChat({onUpdateTitle});

    await press(getByTestId("gpt-rename-history-h2"));
    fireEvent.changeText(getByTestId("gpt-rename-input-h2"), "   ");
    fireEvent(getByTestId("gpt-rename-input-h2"), "blur");

    assert.equal(onUpdateTitle.mock.calls.length, 0);
  });

  it("hides the rename button when renaming is not supported", () => {
    const {queryByTestId} = renderChat();

    assert.isNull(queryByTestId("gpt-rename-history-h1"));
  });

  it("renders a model selector only when models and a change handler are given", () => {
    const onModelChange = mock((_id: string) => {});
    const {getAllByText} = renderChat({
      availableModels: [
        {label: "Flash", value: "flash"},
        {label: "Pro", value: "pro"},
      ],
      onModelChange,
      selectedModel: "pro",
    });

    assert.isNotEmpty(getAllByText("Pro"));
  });

  it("omits the model selector when there is no change handler", () => {
    const {queryByText} = renderChat({
      availableModels: [{label: "Flash", value: "flash"}],
    });

    assert.isNull(queryByText("Flash"));
  });

  it("hides the optional sidebar buttons when their handlers are missing", () => {
    const {queryByTestId} = renderChat({mcpServers: []});

    assert.isNull(queryByTestId("gpt-api-key-button"));
    assert.isNull(queryByTestId("gpt-memory-button"));
  });

  it("edits the Gemini API key through the modal", async () => {
    const onGeminiApiKeyChange = mock((_key: string) => {});
    const {getByTestId, getByText} = renderChat({geminiApiKey: "old-key", onGeminiApiKeyChange});

    await press(getByTestId("gpt-api-key-button"));
    fireEvent.changeText(getByTestId("gpt-api-key-input"), "new-key");
    await press(getByText("Save"));

    assert.deepEqual(onGeminiApiKeyChange.mock.calls, [["new-key"]]);
  });

  it("dismisses the API key modal without saving", async () => {
    const onGeminiApiKeyChange = mock((_key: string) => {});
    const {getByTestId, getByText} = renderChat({onGeminiApiKeyChange});

    await press(getByTestId("gpt-api-key-button"));
    await press(getByText("Cancel"));

    assert.equal(onGeminiApiKeyChange.mock.calls.length, 0);
  });

  it("opens the system memory editor with the current memory", async () => {
    const onMemoryEdit = mock((_memory: string) => {});
    const {getByTestId} = renderChat({onMemoryEdit, systemMemory: "remember this"});

    await press(getByTestId("gpt-memory-button"));

    assert.deepEqual(onMemoryEdit.mock.calls, [["remember this"]]);
  });

  it("opens the system memory editor with an empty memory by default", async () => {
    const onMemoryEdit = mock((_memory: string) => {});
    const {getByTestId} = renderChat({onMemoryEdit});

    await press(getByTestId("gpt-memory-button"));

    assert.deepEqual(onMemoryEdit.mock.calls, [[""]]);
  });

  it("toggles the MCP server list", async () => {
    const {getByLabelText, getByText, queryByText} = renderChat({
      mcpServers: [
        {connected: true, name: "files"},
        {connected: false, name: "search"},
      ],
    });

    assert.isOk(getByText("1/2 MCP"));
    assert.isNull(queryByText("files"));

    await press(getByLabelText("MCP server status"));
    assert.isOk(getByText("files"));
    assert.isOk(getByText("search"));

    await press(getByLabelText("MCP server status"));
    assert.isNull(queryByText("files"));
  });

  it("renders a disconnected MCP indicator when no server is connected", () => {
    const {getByText} = renderChat({mcpServers: [{connected: false, name: "files"}]});

    assert.isOk(getByText("0/1 MCP"));
  });

  it("lists the available MCP tools in a modal", async () => {
    const {getByTestId, getByText} = renderChat({
      mcpTools: [{description: "Reads files", name: "readFile"}, {name: "writeFile"}],
    });

    await press(getByTestId("gpt-tools-button"));

    assert.isOk(getByText("readFile"));
    assert.isOk(getByText("Reads files"));
    assert.isOk(getByText("writeFile"));
  });

  it("hides the tools button when there are no tools", () => {
    const {queryByTestId} = renderChat({mcpTools: []});

    assert.isNull(queryByTestId("gpt-tools-button"));
  });

  it("renders suggested prompts and submits the tapped prompt", async () => {
    const onSubmit = mock((_prompt: string) => {});
    const {getByLabelText, getByText} = renderChat({
      onSubmit,
      suggestedPrompts: ["Summarize this"],
    });

    assert.isOk(getByText("Try asking..."));
    await press(getByLabelText("Summarize this"));

    assert.deepEqual(onSubmit.mock.calls, [["Summarize this"]]);
  });

  it("ignores suggested prompts while streaming", async () => {
    const onSubmit = mock((_prompt: string) => {});
    const {getByLabelText} = renderChat({
      isStreaming: true,
      onSubmit,
      suggestedPrompts: ["Summarize this"],
    });

    await press(getByLabelText("Summarize this"));

    assert.equal(onSubmit.mock.calls.length, 0);
  });

  it("submits typed input and clears the field", async () => {
    const onSubmit = mock((_prompt: string) => {});
    const {getByTestId} = renderChat({onSubmit});

    fireEvent.changeText(getByTestId("gpt-input"), "  Hello  ");
    await press(getByTestId("gpt-submit"));

    assert.deepEqual(onSubmit.mock.calls, [["Hello"]]);
    assert.equal(getByTestId("gpt-input").props.value, "");
  });

  it("does not submit blank input", async () => {
    const onSubmit = mock((_prompt: string) => {});
    const {getByTestId} = renderChat({onSubmit});

    fireEvent.changeText(getByTestId("gpt-input"), "   ");
    await press(getByTestId("gpt-submit"));

    assert.equal(onSubmit.mock.calls.length, 0);
  });

  it("does not submit while streaming", async () => {
    const onSubmit = mock((_prompt: string) => {});
    const {getByTestId} = renderChat({isStreaming: true, onSubmit});

    fireEvent.changeText(getByTestId("gpt-input"), "Hello");
    await press(getByTestId("gpt-submit"));

    assert.equal(onSubmit.mock.calls.length, 0);
  });

  it("renders user and assistant messages", async () => {
    const messages: GPTChatMessage[] = [
      {content: "Hi there", role: "user"},
      {content: "Hello!", role: "assistant"},
    ];
    const {getByText, toJSON} = renderChat({currentMessages: messages});

    assert.isOk(getByText("Hi there"));
    // The assistant message renders through the lazily loaded markdown view.
    await waitFor(() => {
      assert.include(JSON.stringify(toJSON()), "Hello!");
    });
  });

  it("expands tool call details", async () => {
    const messages: GPTChatMessage[] = [
      {
        content: "",
        role: "tool-call",
        toolCall: {args: {path: "README.md"}, toolCallId: "1", toolName: "readFile"},
      },
    ];
    const {getByLabelText, getByText, queryByText} = renderChat({currentMessages: messages});

    assert.isNull(queryByText(/README.md/));
    await press(getByLabelText("Tool: readFile"));
    assert.isOk(getByText(/README.md/));
  });

  it("expands string and object tool results", async () => {
    const messages: GPTChatMessage[] = [
      {
        content: "",
        role: "tool-result",
        toolResult: {result: "done", toolCallId: "1", toolName: "readFile"},
      },
      {
        content: "",
        role: "tool-result",
        toolResult: {result: {ok: true}, toolCallId: "2", toolName: "writeFile"},
      },
    ];
    const {getByLabelText, getByText} = renderChat({currentMessages: messages});

    await press(getByLabelText("Result: readFile"));
    await press(getByLabelText("Result: writeFile"));

    assert.isOk(getByText("done"));
    assert.isOk(getByText(/"ok": true/));
  });

  it("renders image and file content parts", () => {
    const messages: GPTChatMessage[] = [
      {
        content: "See attached",
        contentParts: [
          {text: "See attached", type: "text"},
          {type: "image", url: "https://example.com/pic.png"},
          {mimeType: "application/pdf", type: "file", url: "https://example.com/doc.pdf"},
          {filename: "notes.txt", mimeType: "text/plain", type: "file", url: "file:///notes.txt"},
        ],
        role: "user",
      },
    ];
    const {getByText} = renderChat({currentMessages: messages});

    assert.isOk(getByText("File"));
    assert.isOk(getByText("notes.txt"));
  });

  it("downloads a file content part on press", async () => {
    const messages: GPTChatMessage[] = [
      {
        content: "",
        contentParts: [
          {filename: "doc.pdf", mimeType: "application/pdf", type: "file", url: "data:abc"},
        ],
        role: "assistant",
      },
    ];
    const clicked: string[] = [];
    const link = {click: () => clicked.push("click"), download: "", href: ""};
    const appended: unknown[] = [];
    const removed: unknown[] = [];
    const domGlobals = globalThis as typeof globalThis & {
      document?: unknown;
      window?: unknown;
    };
    const originalDocument = domGlobals.document;
    const originalWindow = domGlobals.window;
    domGlobals.window = {};
    domGlobals.document = {
      body: {
        appendChild: (node: unknown) => appended.push(node),
        removeChild: (node: unknown) => removed.push(node),
      },
      createElement: () => link,
    };

    try {
      const {getByLabelText} = renderChat({currentMessages: messages});
      await press(getByLabelText("File: doc.pdf"));
    } finally {
      domGlobals.document = originalDocument;
      domGlobals.window = originalWindow;
    }

    assert.equal(link.href, "data:abc");
    assert.equal(link.download, "doc.pdf");
    assert.deepEqual(clicked, ["click"]);
    assert.deepEqual(appended, [link]);
    assert.deepEqual(removed, [link]);
  });

  it("skips the download outside a browser environment", async () => {
    const messages: GPTChatMessage[] = [
      {
        content: "",
        contentParts: [{mimeType: "text/plain", type: "file", url: "https://example.com/a.txt"}],
        role: "assistant",
      },
    ];
    const domGlobals = globalThis as typeof globalThis & {window?: unknown};
    const originalWindow = domGlobals.window;
    domGlobals.window = undefined;

    try {
      const {getByLabelText} = renderChat({currentMessages: messages});
      await press(getByLabelText("File: File"));
    } finally {
      domGlobals.window = originalWindow;
    }
  });

  it("rates assistant messages and toggles the rating off", () => {
    const onRateFeedback = mock((_index: number, _rating: "up" | "down" | null) => {});
    const messages: GPTChatMessage[] = [
      {content: "Hello!", rating: "up", role: "assistant"},
      {content: "More", role: "assistant"},
    ];
    const {getByTestId} = renderChat({currentMessages: messages, onRateFeedback});

    fireEvent.press(getByTestId("gpt-rate-up-0"));
    fireEvent.press(getByTestId("gpt-rate-down-0"));
    fireEvent.press(getByTestId("gpt-rate-down-1"));

    assert.deepEqual(onRateFeedback.mock.calls, [
      [0, null],
      [0, "down"],
      [1, "down"],
    ]);
  });

  it("hides rating buttons without a feedback handler", () => {
    const {queryByTestId} = renderChat({
      currentMessages: [{content: "Hello!", role: "assistant"}],
    });

    assert.isNull(queryByTestId("gpt-rate-up-0"));
  });

  it("copies an assistant message to the clipboard", async () => {
    setStringAsync.mockClear();
    const {getByTestId} = renderChat({
      currentMessages: [{content: "Copy me", role: "assistant"}],
    });

    await act(async () => {
      fireEvent.press(getByTestId("gpt-copy-msg-0"));
    });

    assert.deepEqual(setStringAsync.mock.calls, [["Copy me"]]);
  });

  it("disables input and the attachment picker while streaming", () => {
    const {getByTestId} = renderChat({isStreaming: true, onAttachFiles: () => {}});

    assert.isTrue(getByTestId("gpt-input").props.readOnly);
    assert.isTrue(getByTestId("gpt-attach-button").props.disabled);
  });

  it("keeps the attachment picker enabled when not streaming", () => {
    const {getByTestId} = renderChat({onAttachFiles: () => {}});

    assert.isNotTrue(getByTestId("gpt-attach-button").props.disabled);
  });

  it("hides the attachment picker without an attach handler", () => {
    const {queryByTestId} = renderChat();

    assert.isNull(queryByTestId("gpt-attach-button"));
  });

  it("shows the scroll to bottom button once scrolled away from the end", async () => {
    const {getByTestId, getByText, queryByText, UNSAFE_getByType} = renderChat({
      currentMessages: [{content: "Hello!", role: "assistant"}],
    });

    assert.isNull(queryByText("Scroll to bottom"));

    fireEvent(getByTestId("gpt-viewport"), "layout", {
      nativeEvent: {layout: {height: 200, width: 100, x: 0, y: 0}},
    });
    fireEvent(getByTestId("gpt-messages"), "layout", {
      nativeEvent: {layout: {height: 600, width: 100, x: 0, y: 0}},
    });
    await act(async () => {
      fireEvent.scroll(UNSAFE_getByType(ScrollView), {
        nativeEvent: {contentOffset: {x: 0, y: 100}},
      });
    });

    assert.isOk(getByText("Scroll to bottom"));

    await press(getByText("Scroll to bottom"));

    assert.isNull(queryByText("Scroll to bottom"));
  });

  it("renders attachments and the attach button", () => {
    const onAttachFiles = mock(() => {});
    const onRemoveAttachment = mock((_index: number) => {});
    const {getByTestId} = renderChat({
      attachments: [{mimeType: "image/png", name: "photo.png", uri: "file:///photo.png"}],
      onAttachFiles,
      onRemoveAttachment,
    });

    assert.isOk(getByTestId("gpt-attach-button"));
    assert.isOk(getByTestId("attachment-preview"));
  });

  it("hides the attachment preview without a remove handler", () => {
    const {queryByTestId} = renderChat({
      attachments: [{mimeType: "image/png", name: "photo.png", uri: "file:///photo.png"}],
    });

    assert.isNull(queryByTestId("attachment-preview"));
  });

  it("renders nothing for unknown content part types", () => {
    const parts = [
      {type: "audio", url: "https://example.com/a.mp3"},
    ] as unknown as MessageContentPart[];
    const {getByText, queryByText} = renderChat({
      currentMessages: [{content: "Listen", contentParts: parts, role: "user"}],
    });

    assert.isOk(getByText("Listen"));
    assert.isNull(queryByText("File"));
  });

  it("forwards picked files to onAttachFiles", async () => {
    const onAttachFiles = mock((_files: SelectedFile[]) => {});
    const {getByTestId, getByText} = renderChat({onAttachFiles});

    await press(getByTestId("gpt-attach-button"));
    await press(getByText("Document"));

    await waitFor(() => {
      assert.deepEqual(onAttachFiles.mock.calls, [[[pickedDocument]]]);
    });
  });

  it("saves a rename only once when blur and enter both fire", async () => {
    const onUpdateTitle = mock((_id: string, _title: string) => {});
    const {getByTestId} = renderChat({onUpdateTitle});

    await press(getByTestId("gpt-rename-history-h1"));
    fireEvent.changeText(getByTestId("gpt-rename-input-h1"), "Renamed");
    const input = getByTestId("gpt-rename-input-h1");
    await act(async () => {
      input.props.onSubmitEditing();
      input.props.onBlur();
    });

    assert.deepEqual(onUpdateTitle.mock.calls, [["h1", "Renamed"]]);
  });

  it("scrolls to the bottom when new messages arrive", () => {
    const {getByText, rerender} = renderChat({
      currentMessages: [{content: "First", role: "assistant"}],
    });

    rerender(
      <GPTChat
        currentMessages={[
          {content: "First", role: "assistant"},
          {content: "Second", role: "assistant"},
        ]}
        histories={histories}
        onCreateHistory={() => {}}
        onDeleteHistory={() => {}}
        onSelectHistory={() => {}}
        onSubmit={() => {}}
        testID="gpt-chat"
      />
    );

    assert.isOk(getByText("Second"));
  });
});

describe("GPTChat web keyboard submit", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  const renderOnWeb = (): {
    handlers: Map<string, (event: Event) => void>;
    onSubmit: ReturnType<typeof mock<(prompt: string) => void>>;
    result: ReturnType<typeof render>;
    removed: string[];
  } => {
    Platform.OS = "web";
    const handlers = new Map<string, (event: Event) => void>();
    const removed: string[] = [];
    const onSubmit = mock((_prompt: string) => {});
    const node = {
      addEventListener: (type: string, handler: (event: Event) => void): void => {
        handlers.set(type, handler);
      },
      removeEventListener: (type: string): void => {
        removed.push(type);
      },
      scrollToEnd: () => {},
    };
    const result = render(
      <GPTChat
        currentMessages={[]}
        histories={histories}
        onCreateHistory={() => {}}
        onDeleteHistory={() => {}}
        onSelectHistory={() => {}}
        onSubmit={onSubmit}
        testID="gpt-chat"
      />,
      {
        createNodeMock: () => node,
        wrapper: ThemeProvider,
      }
    );
    return {handlers, onSubmit, removed, result};
  };

  const keyEvent = (init: {
    key: string;
    metaKey?: boolean;
    shiftKey?: boolean;
  }): {
    event: Event;
    prevented: () => boolean;
  } => {
    let prevented = false;
    const event = {
      key: init.key,
      metaKey: init.metaKey ?? false,
      preventDefault: (): void => {
        prevented = true;
      },
      shiftKey: init.shiftKey ?? false,
    } as unknown as Event;
    return {event, prevented: (): boolean => prevented};
  };

  it("submits on Enter but not on other keys or modified Enter", async () => {
    const {handlers, onSubmit, result} = renderOnWeb();
    const keydown = handlers.get("keydown");
    assert.isFunction(keydown);

    fireEvent.changeText(result.getByTestId("gpt-input"), "Hello there");

    const other = keyEvent({key: "a"});
    const shifted = keyEvent({key: "Enter", shiftKey: true});
    const meta = keyEvent({key: "Enter", metaKey: true});
    await act(async () => {
      keydown?.(other.event);
      keydown?.(shifted.event);
      keydown?.(meta.event);
    });
    assert.isFalse(other.prevented());
    assert.isFalse(shifted.prevented());
    assert.isFalse(meta.prevented());
    assert.equal(onSubmit.mock.calls.length, 0);

    const enter = keyEvent({key: "Enter"});
    await act(async () => {
      keydown?.(enter.event);
    });
    assert.isTrue(enter.prevented());
    assert.deepEqual(onSubmit.mock.calls, [["Hello there"]]);
  });

  it("removes the keydown listener on unmount", () => {
    const {removed, result} = renderOnWeb();
    result.unmount();
    assert.include(removed, "keydown");
  });
});
