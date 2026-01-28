import {DemoConfiguration} from "@config";
import {
  HeightFieldDemo,
  HeightFieldDisabledDemo,
  HeightFieldRequiredDemo,
  HeightFieldWithErrorDemo,
  HeightFieldWithHelperTextDemo,
  HeightFieldWithValueDemo,
} from "@stories";
import {HeightField} from "@terreno/ui";
import React from "react";

export const HeightFieldConfiguration: DemoConfiguration = {
  name: "Height field",
  component: HeightField,
  related: ["Number field", "Text field"],
  description:
    "Use the Height field to allow users to input their height. The field stores the value as total inches and displays it as feet and inches. On mobile, tapping the field opens a spinner modal for selection.",
  a11yNotes: [
    "Users should be able to use tab to navigate between the feet and inches inputs.",
    "The field should announce the current value to screen readers.",
    "On mobile, the action sheet should be accessible via screen readers.",
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
  interfaceName: "HeightFieldProps",
  usage: {
    do: [
      "Use this component for height input in forms.",
      "Display the value in a human-readable format (e.g., 5ft 10in).",
      "Provide clear error messages when validation fails.",
    ],
    doNot: [
      "Do not use this component for other measurements like weight or distance.",
      "Do not allow values outside the valid range (0-8 feet, 0-11 inches).",
    ],
  },
  props: {},
  demo: HeightFieldDemo,
  demoOptions: {},
  stories: {
    "Basic Height Field": {
      render: HeightFieldDemo,
    },
    "Height Field with Value": {
      render: HeightFieldWithValueDemo,
    },
    "Height Field with Helper Text": {
      render: HeightFieldWithHelperTextDemo,
    },
    "Height Field with Error": {
      render: HeightFieldWithErrorDemo,
    },
    "Disabled Height Field": {
      render: HeightFieldDisabledDemo,
    },
    "Required Height Field": {
      render: HeightFieldRequiredDemo,
    },
  },
};
