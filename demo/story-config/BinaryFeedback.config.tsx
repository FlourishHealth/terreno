import {DemoConfiguration} from "@config";
import {
  BinaryFeedbackDemo,
  BinaryFeedbackStories,
  BinaryFeedbackWithConfirmation,
} from "@stories/BinaryFeedback.stories";
import {BinaryFeedback} from "@terreno/ui";
import React from "react";

export const BinaryFeedbackConfiguration: DemoConfiguration = {
  name: "BinaryFeedback",
  related: ["AiSuggestionBox", "IconButton"],
  description:
    "BinaryFeedback is a thumbs up / thumbs down pair for collecting a single positive or negative reaction, e.g. on an AI generated response. Pressing the selected option again clears the selection.",
  category: "Component",
  component: BinaryFeedback,
  status: {
    documentation: "planned",
    figma: "ready",
    figmaLink:
      "https://www.figma.com/design/ykXj5qjjtFjOYkAvTasu9r/Terreno-Design-System?node-id=3800-6018",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  usage: {
    do: [
      "Use to collect a quick, low-effort reaction to a single piece of content",
      "Place it directly next to the content it applies to",
      "Persist the selection so the user can see the feedback they already gave",
    ],
    doNot: [
      "Do not use for more than two choices — use RadioField or SegmentedControl instead",
      "Do not use as a form field with a title, helper text, or validation",
      "Do not rely on the selection alone for detailed feedback — pair it with a text field when you need more",
    ],
  },
  a11yNotes: [
    "Each option is a button with an accessibility label, customizable via positiveAccessibilityLabel and negativeAccessibilityLabel",
    "Selection is announced via accessibilityState, not color alone",
  ],
  interfaceName: "BinaryFeedbackProps",
  props: {},
  demo: BinaryFeedbackDemo,
  demoOptions: {
    size: "md",
    controls: {
      size: {
        type: "select",
        options: [
          {label: "Small", value: "sm"},
          {label: "Medium", value: "md"},
          {label: "Large", value: "lg"},
        ],
        defaultValue: "md",
      },
      disabled: {
        type: "boolean",
        defaultValue: false,
      },
    },
  },
  stories: {
    "Binary Feedback": {
      description: "All states and sizes.",
      render: () => <BinaryFeedbackStories />,
    },
    "Inline Feedback Prompt": {
      description: "Paired with a static prompt and a confirmation line shown after feedback.",
      render: () => <BinaryFeedbackWithConfirmation />,
    },
  },
};
