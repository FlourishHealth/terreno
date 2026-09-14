import {Box, EditableCard, Heading, ThemeProvider} from "@terreno/ui";
import type React from "react";

const darkPrimitives = {
  neutral000: "#1C1C1C",
  neutral050: "#353535",
  neutral100: "#4E4E4E",
  neutral200: "#686868",
  neutral300: "#9A9A9A",
  neutral400: "#B3B3B3",
  neutral500: "#CDCDCD",
  neutral600: "#D9D9D9",
  neutral700: "#E6E6E6",
  neutral800: "#121212",
  neutral900: "#FFFFFF",
  primary300: "#0086B3",
  primary400: "#0E9DCD",
  primary500: "#40B8E0",
  // A dark theme needs a dark attention surface, otherwise the light default washes out the text.
  secondary000: "#25333A",
};

export const EditableCardDemo = (): React.ReactElement => {
  return (
    <Box color="neutralLight" direction="column" padding={4} width="100%">
      <EditableCard
        badge={{iconName: "check", secondary: true, status: "success", value: "Verified"}}
        description="123 Main Street, Springfield, IL 62704"
        editAccessibilityLabel="Edit home address"
        helperText="Last updated 2 days ago"
        iconName="location-dot"
        onEdit={() => console.info("Edit home address")}
        title="Home Address"
      />
    </Box>
  );
};

export const EditableCardStates = (): React.ReactElement => {
  return (
    <Box
      color="neutralLight"
      direction="column"
      gap={4}
      padding={4}
      testID="editable-card-story-states"
      width="100%"
    >
      <EditableCard
        badge={{iconName: "check", secondary: true, status: "success", value: "Verified"}}
        description="123 Main Street, Springfield, IL 62704"
        editAccessibilityLabel="Edit home address"
        helperText="Last updated 2 days ago"
        iconName="location-dot"
        onEdit={() => console.info("Edit home address")}
        title="Home Address"
      />
      <EditableCard
        attention
        badge={{
          iconName: "triangle-exclamation",
          secondary: true,
          status: "warning",
          value: "Needs review",
        }}
        description="456 Oak Avenue, Springfield, IL 62704"
        editAccessibilityLabel="Edit mailing address"
        helperText="Confirm this address is still correct."
        iconName="location-dot"
        onEdit={() => console.info("Edit mailing address")}
        title="Mailing Address"
      />
      <EditableCard
        description="No icon, badge, or helper text — just a title, description, and edit action."
        editAccessibilityLabel="Edit preferred name"
        onEdit={() => console.info("Edit preferred name")}
        title="Preferred Name"
      />
    </Box>
  );
};

export const EditableCardLightAndDark = (): React.ReactElement => {
  return (
    <Box
      direction="column"
      gap={4}
      padding={4}
      testID="editable-card-story-light-and-dark"
      width="100%"
    >
      <Heading size="sm">Light</Heading>
      <Box color="neutralLight" padding={4}>
        <EditableCard
          badge={{iconName: "check", secondary: true, status: "success", value: "Verified"}}
          description="123 Main Street, Springfield, IL 62704"
          editAccessibilityLabel="Edit home address"
          helperText="Last updated 2 days ago"
          iconName="location-dot"
          onEdit={() => console.info("Edit home address")}
          title="Home Address"
        />
      </Box>

      <Heading size="sm">Dark</Heading>
      <ThemeProvider initialPrimitives={darkPrimitives}>
        <Box color="neutralLight" padding={4}>
          <EditableCard
            attention
            badge={{
              iconName: "triangle-exclamation",
              secondary: true,
              status: "warning",
              value: "Needs review",
            }}
            description="456 Oak Avenue, Springfield, IL 62704"
            editAccessibilityLabel="Edit mailing address"
            helperText="Confirm this address is still correct."
            iconName="location-dot"
            onEdit={() => console.info("Edit mailing address")}
            title="Mailing Address"
          />
        </Box>
      </ThemeProvider>
    </Box>
  );
};
