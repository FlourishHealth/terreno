import {Box, Card, Heading, Text, ThemeProvider} from "@terreno/ui";

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

export const LightAndDark = () => {
  return (
    <Box direction="column" display="flex" gap={4} width="100%">
      <Box color="neutralLight" padding={4} rounding="md">
        <Box marginBottom={2}>
          <Text bold color="secondaryLight">
            Light mode
          </Text>
        </Box>
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
      <ThemeProvider initialPrimitives={darkPrimitives}>
        <Box color="neutralDark" padding={4} rounding="md">
          <Box marginBottom={2}>
            <Text bold color="secondaryLight">
              Dark mode
            </Text>
          </Box>
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
      </ThemeProvider>
    </Box>
  );
};

export const WithImage = () => {
  return (
    <Box direction="row" display="flex" gap={4} wrap>
      <Box width={280}>
        <Card imageAlt="Mountain landscape" imageUri={SAMPLE_IMAGE}>
          <Heading size="sm">Mountain Vista</Heading>
          <Text color="secondaryLight">A breathtaking view from the summit.</Text>
        </Card>
      </Box>
      <ThemeProvider initialPrimitives={darkPrimitives}>
        <Box width={280}>
          <Card imageAlt="Mountain landscape" imageUri={SAMPLE_IMAGE}>
            <Heading size="sm">Mountain Vista</Heading>
            <Text color="secondaryLight">A breathtaking view from the summit.</Text>
          </Card>
        </Box>
      </ThemeProvider>
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
