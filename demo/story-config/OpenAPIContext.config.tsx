import {DemoConfiguration} from "@config";

import {OpenAPIContextDemo, OpenAPIContextStories} from "../stories/OpenAPIContext.stories";

export const OpenAPIContextConfiguration: DemoConfiguration = {
  name: "OpenAPI Context",
  component: () => null,
  related: ["TerrenoProvider"],
  description:
    "Loads backend OpenAPI metadata and exposes model field descriptions through useOpenAPISpec.",
  a11yNotes: ["Field descriptions should remain available after unrelated parent rerenders."],
  category: "Foundation",
  status: {
    documentation: "ready",
    figma: "notSupported",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  additionalDocumentation: [],
  interfaceName: "OpenAPIProviderProps",
  usage: {
    do: ["Wrap admin or form screens that read model metadata in OpenAPIProvider or TerrenoProvider."],
    doNot: ["Fetch OpenAPI specs manually in every field component."],
  },
  props: {},
  demo: OpenAPIContextDemo,
  demoOptions: {},
  stories: {
    "Field metadata": {render: OpenAPIContextStories},
  },
};
