import {DemoConfiguration} from "@config";
import {PageDemo, PageLoadingBoolean, PageLoadingText} from "@stories";
import {Page} from "@terreno/ui";

export const PageConfiguration: DemoConfiguration = {
  name: "Page",
  component: Page,
  related: ["Box", "Spinner"],
  description:
    "Page is a full-screen layout container with an optional header, footer, back/close buttons, and loading state. It handles scrolling, keyboard avoidance, and max-width centering.",
  a11yNotes: [],
  category: "Component",
  status: {
    documentation: "ready",
    figma: "ready",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  additionalDocumentation: [],
  interfaceName: "PageProps",
  usage: {
    do: [
      "Use as the root layout for every screen.",
      "Pass loading={true} to show a centered spinner while data is fetching.",
      "Pass a string to loading (e.g. loading=\"Saving…\") to display a message beneath the spinner.",
    ],
    doNot: [
      "Do not nest Page components.",
      "Do not use loading and children simultaneously — the loading state replaces content.",
    ],
  },
  props: {},
  demo: PageDemo,
  demoOptions: {
    size: "lg",
    controls: {
      title: {
        type: "text",
        defaultValue: "Page Title",
      },
      loading: {
        type: "text",
        defaultValue: "",
      },
    },
  },
  stories: {
    LoadingBoolean: {
      description: "Shows a centered spinner when loading is true.",
      render: PageLoadingBoolean,
    },
    LoadingText: {
      description: "Shows a centered spinner with a message beneath it when loading is a string.",
      render: PageLoadingText,
    },
  },
};
