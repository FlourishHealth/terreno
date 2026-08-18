import {DemoConfiguration} from "@config";
import {
  DocumentPopoverDemo,
  DocumentPopoverStories,
  DocumentPopoverWithoutFooter,
} from "@stories/DocumentPopover.stories";
import {DocumentPopover} from "@terreno/ui";
import React from "react";

export const DocumentPopoverConfiguration: DemoConfiguration = {
  name: "DocumentPopover",
  related: ["Card", "Modal", "ThumbsUpDownFeedback"],
  description:
    "DocumentPopover previews a single document next to the thing that references it: a header with the document title and date, the document body, and a footer with an Open action and optional thumbs up / thumbs down feedback. It renders a loading spinner or a retryable error message based on status. Positioning is left to the consumer.",
  category: "Component",
  component: DocumentPopover,
  status: {
    documentation: "planned",
    figma: "ready",
    figmaLink:
      "https://www.figma.com/design/ykXj5qjjtFjOYkAvTasu9r/Terreno-Design-System?node-id=3774-64",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  usage: {
    do: [
      "Use to preview a document inline, with Open for the full document",
      "Keep the header to a document title and its date",
      "Drive the loading and error states from the request that fetches the document",
    ],
    doNot: [
      "Do not use for arbitrary popover content — it is document specific",
      "Do not use for a blocking, full-screen document view — use Modal or a page instead",
      "Do not show the feedback controls unless the feedback is recorded somewhere",
    ],
  },
  a11yNotes: [
    "The close button is labelled 'Close document' and hints that it closes the preview",
    "The Open action is exposed as a button with the openText as its label",
    "Feedback options come from ThumbsUpDownFeedback, so selection is announced as checked",
  ],
  interfaceName: "DocumentPopoverProps",
  props: {},
  demo: DocumentPopoverDemo,
  demoOptions: {
    size: "md",
    controls: {
      status: {
        type: "select",
        options: [
          {label: "loaded", value: "loaded"},
          {label: "loading", value: "loading"},
          {label: "error", value: "error"},
        ],
        defaultValue: "loaded",
      },
    },
  },
  stories: {
    "Document States": {
      description: "Loaded, loading, and error states.",
      render: () => <DocumentPopoverStories />,
    },
    "Without Footer Actions": {
      description: "Omitting onOpen and onFeedbackChange hides the footer entirely.",
      render: () => <DocumentPopoverWithoutFooter />,
    },
  },
};
