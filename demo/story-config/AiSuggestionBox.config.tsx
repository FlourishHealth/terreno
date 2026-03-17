import {DemoConfiguration} from "@config";
import {
  AiSuggestionAdded,
  AiSuggestionAllStates,
  AiSuggestionGenerating,
  AiSuggestionNotStarted,
  AiSuggestionReady,
} from "@stories";
import {AiSuggestionBox} from "@terreno/ui";

export const AiSuggestionBoxConfiguration: DemoConfiguration = {
  name: "AI Suggestion Box",
  component: AiSuggestionBox,
  related: ["Text area", "Text field"],
  description:
    "An AI suggestion block that renders inside TextField or TextArea. Shows AI-generated content with feedback controls and add-to-note actions. Supports multiple states: not-started, generating, ready, and added.",
  a11yNotes: [
    "Thumbs up and thumbs down buttons have accessibility labels.",
    "Show/Hide and Add to note buttons have accessibility roles.",
    "Collapsed state is pressable to expand.",
  ],
  category: "Component",
  status: {
    documentation: "inProgress",
    figma: "ready",
    figmaLink:
      "https://www.figma.com/design/IkkIQgkXtNsMzJo549ELVF/AI-Notetaking?node-id=7096-1516",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  additionalDocumentation: [],
  interfaceName: "AiSuggestionBoxProps",
  usage: {
    do: [
      "Use inside a TextField or TextArea via the aiSuggestion prop.",
      "Provide an onAdd callback to handle inserting the suggestion into the field.",
      "Provide an onFeedback callback to capture thumbs up/down feedback.",
    ],
    doNot: [
      "Do not use outside of a text input context.",
      "Do not omit the text prop when status is 'ready' or 'added'.",
    ],
  },
  props: {},
  demo: AiSuggestionAllStates,
  demoOptions: {},
  stories: {
    NotStarted: {render: AiSuggestionNotStarted},
    Generating: {render: AiSuggestionGenerating},
    Ready: {render: AiSuggestionReady},
    Added: {render: AiSuggestionAdded},
    AllStates: {render: AiSuggestionAllStates},
  },
};
