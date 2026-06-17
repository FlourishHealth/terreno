import {DemoConfiguration} from "@config";
import {
  CitationTooltipDemo,
  CitationTooltipPositions,
  CitationTooltipRichContent,
  CitationTooltipScrollableContent,
} from "@stories";
import {CitationTooltip} from "@terreno/ui";

export const CitationTooltipConfiguration: DemoConfiguration = {
  name: "CitationTooltip",
  component: CitationTooltip,
  related: ["Tooltip"],
  description:
    "CitationTooltip is a structured popover triggered by an inline citation marker. It shows a header, scrollable content body, and an optional action area — designed for referencing sources, footnotes, or supplementary detail inline within text.",
  shortDescription: "Inline citation marker that opens a structured popover with header, content, and actions.",
  a11yNotes: [
    "The marker badge acts as a button — ensure screen readers can reach it.",
    "The close button inside the popover is labelled 'close citation'.",
    "Content inside the popover should be meaningful to screen reader users.",
  ],
  category: "Component",
  status: {
    documentation: "ready",
    figma: "planned",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  additionalDocumentation: [],
  interfaceName: "CitationTooltipProps",
  usage: {
    do: [
      "Use to surface citations, footnotes, or source references inline within text.",
      "Keep the marker short — a number, letter, or symbol works best.",
      "Use actions for navigation to the full source or copy functionality.",
    ],
    doNot: [
      "Do not use for critical information — users may miss it.",
      "Do not put long-form content directly in the marker.",
    ],
  },
  props: {},
  demo: CitationTooltipDemo,
  demoOptions: {
    controls: {
      idealPosition: {
        type: "select",
        defaultValue: "top",
        options: [
          {label: "Top", value: "top"},
          {label: "Bottom", value: "bottom"},
          {label: "Left", value: "left"},
          {label: "Right", value: "right"},
        ],
      },
      maxContentHeight: {
        type: "number",
        defaultValue: 150,
      },
    },
  },
  stories: {
    Positions: {render: () => CitationTooltipPositions()},
    RichContent: {render: () => CitationTooltipRichContent()},
    ScrollableContent: {
      description:
        "A long article with citations near the top, middle, and bottom for testing scroll behavior. The page itself scrolls, and citation 3 has content taller than `maxContentHeight` so its middle section scrolls independently. Odd-numbered citations (1, 3, 5) set `dismissOnScroll={false}` and stay open while the page scrolls; even-numbered citations (2, 4) dismiss when scrolling outside the popover.",
      render: () => CitationTooltipScrollableContent(),
    },
  },
};
