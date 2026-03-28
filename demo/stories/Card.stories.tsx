import {Box, Button, Card, Heading, Text, ThemeProvider} from "@terreno/ui";
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
};

const SAMPLE_IMAGE = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80";

export const CardDemo = () => {
  return (
    <Box color="neutralLight" direction="column" display="flex" height="100%" width="100%">
      <Card>
        <Box alignItems="center" direction="row" display="flex">
          <Box
            alignItems="center"
            color="primary"
            display="flex"
            height={50}
            justifyContent="center"
            marginRight={2}
            rounding="circle"
            width={50}
          >
            <Text color="inverted">JG</Text>
          </Box>
          <Box direction="column" paddingX={2}>
            <Text bold>Josh Gachnang</Text>
            <Text color="secondaryLight">joined 2 years ago</Text>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export const Plain = () => {
  return (
    <Box
      color="neutralLight"
      direction="column"
      display="flex"
      height="100%"
      padding={12}
      width="100%"
    >
      <Card>
        <Box alignItems="center" direction="row" display="flex">
          <Box
            alignItems="center"
            color="primary"
            display="flex"
            height={50}
            justifyContent="center"
            marginRight={2}
            rounding="circle"
            width={50}
          >
            <Text color="inverted">JG</Text>
          </Box>
          <Box direction="column" paddingX={2}>
            <Text bold>Josh Gachnang</Text>
            <Text color="secondaryLight">joined 2 years ago</Text>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export const DisplayCardDemo = (): React.ReactElement => {
  return (
    <Box color="neutralLight" direction="column" gap={4} padding={4} width="100%">
      <Card
        buttonOnClick={() => console.info("Learn more clicked")}
        buttonText="Learn More"
        description="Discover the latest features in Terreno's design system to build better apps faster."
        title="What's New in Terreno"
        variant="display"
      />
      <Card
        buttonOnClick={() => console.info("Get started clicked")}
        buttonText="Get Started"
        description="Follow the setup guide to integrate Terreno into your project in minutes."
        headerColor="secondaryDark"
        title="Quick Start Guide"
        variant="display"
      />
      <Card
        description="Your data is protected with end-to-end encryption and regular security audits."
        headerColor="success"
        title="Security & Privacy"
        variant="display"
      />
    </Box>
  );
};

export const CardVariants = (): React.ReactElement => {
  return (
    <Box color="neutralLight" direction="column" gap={4} padding={4} width="100%">
      <Heading size="sm">Container (default)</Heading>
      <Card>
        <Box direction="column" gap={2}>
          <Heading size="md">Container Card</Heading>
          <Text>
            Wraps any content with a card surface. Great for grouping related information.
          </Text>
          <Button onClick={() => console.info("clicked")} text="Action" variant="outline" />
        </Box>
      </Card>

      <Heading size="sm">Display</Heading>
      <Card
        buttonOnClick={() => console.info("clicked")}
        buttonText="Try It Now"
        description="Use display cards to highlight a new feature or guide users into a flow."
        title="Display Card"
        variant="display"
      />
    </Box>
  );
};

export const LightAndDark = (): React.ReactElement => {
  return (
    <Box direction="column" display="flex" gap={4} width="100%">
      <Box color="neutralLight" padding={4} rounding="md">
        <Box marginBottom={2}>
          <Text bold color="secondaryLight">
            Light mode
          </Text>
        </Box>
        <Card
          description="Cards adapt to the active theme automatically."
          title="Light Theme"
          variant="display"
        />
      </Box>
      <ThemeProvider initialPrimitives={darkPrimitives}>
        <Box color="neutralDark" padding={4} rounding="md">
          <Box marginBottom={2}>
            <Text bold color="secondaryLight">
              Dark mode
            </Text>
          </Box>
          <Card
            description="Cards adapt to the active theme automatically."
            title="Dark Theme"
            variant="display"
          />
        </Box>
      </ThemeProvider>
    </Box>
  );
};

export const WithImage = (): React.ReactElement => {
  return (
    <Box direction="row" display="flex" gap={4} wrap>
      <Box width={280}>
        <Card
          buttonOnClick={() => console.info("clicked")}
          buttonText="Explore"
          description="A breathtaking view from the summit."
          imageAlt="Mountain landscape"
          imageUri={SAMPLE_IMAGE}
          title="Mountain Vista"
          variant="display"
        />
      </Box>
      <ThemeProvider initialPrimitives={darkPrimitives}>
        <Box width={280}>
          <Card
            buttonOnClick={() => console.info("clicked")}
            buttonText="Explore"
            description="A breathtaking view from the summit."
            imageAlt="Mountain landscape"
            imageUri={SAMPLE_IMAGE}
            title="Mountain Vista"
            variant="display"
          />
        </Box>
      </ThemeProvider>
    </Box>
  );
};
