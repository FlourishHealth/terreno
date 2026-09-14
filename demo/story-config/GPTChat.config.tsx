import type {DemoConfiguration} from "@config";
import {GPTChatDemo, GPTChatEmpty, GPTChatStreaming} from "@stories/GPTChat.stories";
import {GPTChat} from "@terreno/ui";

export const GPTChatConfiguration: DemoConfiguration = {
  name: "GPTChat",
  component: GPTChat,
  related: ["AiSuggestionBox", "MarkdownView"],
  description:
    "Streaming chat surface for Terreno AI. This demo uses a static message list — it does not call a live backend.",
  a11yNotes: ["Chat history and message list should remain keyboard reachable."],
  category: "Pattern",
  status: {
    documentation: "ready",
    figma: "planned",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  additionalDocumentation: [],
  interfaceName: "GPTChatProps",
  usage: {
    do: [
      "Pass currentMessages and histories from your AI routes.",
      "Keep submit local or mocked in stories so the demo runs without an API.",
    ],
    doNot: ["Do not require a live model endpoint to render the component."],
  },
  props: {},
  demo: () => <GPTChatDemo />,
  demoOptions: {size: "lg"},
  stories: {
    Empty: {
      description: "No messages, with suggested prompts.",
      render: () => <GPTChatEmpty />,
    },
    Streaming: {
      description: "Assistant reply in progress.",
      render: () => <GPTChatStreaming />,
    },
  },
};
