import {Box, Button, Card, Heading, Text} from "@terreno/ui";
import type React from "react";

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
            <Text>JG</Text>
          </Box>
          <Box direction="column" paddingX={2}>
            <Text>Josh Gachnang</Text>
            <Text>joined 2 years ago</Text>
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
            <Text>JG</Text>
          </Box>
          <Box direction="column" paddingX={2}>
            <Text>Josh Gachnang</Text>
            <Text>joined 2 years ago</Text>
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
