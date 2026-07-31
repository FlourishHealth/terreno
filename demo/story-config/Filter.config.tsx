import {DemoConfiguration} from "@config";
import {
  FilterChipStory,
  FilterDemo,
  FilterInlineStory,
  FilterStackedStory,
} from "@stories/Filter.stories";
import {Filter} from "@terreno/ui";

export const FilterConfiguration: DemoConfiguration = {
  name: "Filter",
  component: Filter,
  related: ["Multiselect Field", "Select Field", "Data Table"],
  description:
    "Filter renders a set of filter controls from a declarative list of definitions, plus a dismissible chip for every value currently applied and a clear-all action. Use it above or beside any result list so users can narrow what they see and always know what is already applied.",
  a11yNotes: [
    "Every chip's dismiss button has an accessible label of the form 'Remove {label} filter'.",
    "The chip row states the applied filters as text, so the current state does not rely on color or position alone.",
    "Each control keeps the field title of the underlying component, so screen readers announce what is being filtered.",
  ],
  category: ["Component", "Data Entry"],
  status: {
    documentation: "ready",
    figma: "planned",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  interfaceName: "FilterProps",
  usage: {
    do: [
      "Show the applied filters as chips so users can undo one without hunting for its control.",
      "Use the stacked layout for a sidebar rail and the inline layout for a toolbar above a table.",
      "Make the panel collapsible when filters are secondary to the results.",
      "Keep the values record controlled by the screen that owns the query, so filters and paging stay in sync.",
    ],
    doNot: [
      "Do not build one-off filter forms out of raw select and text fields.",
      "Do not hide the clear-all action when filters are applied — leaving a filter on by accident is the most common failure.",
      "Do not put more than a handful of filters inline; collapse or stack them instead.",
    ],
  },
  props: {},
  demo: FilterDemo,
  demoOptions: {
    size: "lg",
    controls: {
      layout: {
        type: "select",
        defaultValue: "stacked",
        options: [
          {label: "Stacked", value: "stacked"},
          {label: "Inline", value: "inline"},
        ],
      },
      collapsible: {
        type: "boolean",
        defaultValue: false,
      },
      showActiveFilters: {
        type: "boolean",
        defaultValue: true,
      },
      showClearAll: {
        type: "boolean",
        defaultValue: true,
      },
      title: {
        type: "text",
        defaultValue: "Filters",
      },
    },
  },
  stories: {
    "Stacked rail": {
      description: "A sidebar rail beside a result list, the layout an admin changelist uses.",
      render: () => <FilterStackedStory />,
    },
    "Inline toolbar": {
      description: "A collapsible toolbar above a table, with chips visible even when collapsed.",
      render: () => <FilterInlineStory />,
    },
    "Filter chips": {
      description: "FilterChip on its own, for rendering applied filters outside the panel.",
      render: () => <FilterChipStory />,
    },
  },
};
