import {Box, Button, Icon, IconButton, type IconProps, Text} from "@terreno/ui";

import {StorybookContainer} from "./StorybookContainer";

export const IconDemo = (props: Partial<IconProps>) => (
  <Box alignItems="center" direction="row" justifyContent="center" padding={6}>
    <Icon iconName="triangle-exclamation" size="xl" {...props} />
  </Box>
);

export const SolidIcons = (
  <StorybookContainer>
    <Box
      direction="row"
      display="flex"
      height="100%"
      justifyContent="between"
      maxWidth={300}
      width="100%"
    >
      <Icon iconName="heart" />
      <Icon iconName="plus" />
      <Icon iconName="pencil" />
      <Icon iconName="heart" />
    </Box>
  </StorybookContainer>
);

export const IconStyles = (
  <StorybookContainer>
    <Box padding={6}>
      <Text>Solid</Text>
      <Icon iconName="heart" size="xl" type="solid" />
    </Box>
    <Box padding={6}>
      <Text>Regular</Text>
      <Icon iconName="heart" size="xl" type="regular" />
    </Box>
  </StorybookContainer>
);

export const CustomIcons = (
  <StorybookContainer>
    <Box gap={4} padding={6}>
      <Text>
        The "sparkle" icon is a custom SVG registered on the demo's root TerrenoProvider (see
        components/customIcons.tsx). Once registered, it is usable by name anywhere an iconName is
        accepted.
      </Text>
      <Box alignItems="center" direction="row" gap={4}>
        <Icon color="primary" iconName="sparkle" size="xs" />
        <Icon color="primary" iconName="sparkle" size="md" />
        <Icon color="accent" iconName="sparkle" size="xl" />
        <Icon color="error" iconName="sparkle" size="2xl" />
      </Box>
      <Box alignItems="center" direction="row" gap={4}>
        <Button iconName="sparkle" onClick={() => {}} text="Sparkle" />
        <IconButton accessibilityLabel="Sparkle" iconName="sparkle" onClick={() => {}} />
      </Box>
    </Box>
  </StorybookContainer>
);

export const IconSizes = (
  <StorybookContainer>
    <Box
      direction="row"
      display="flex"
      height="100%"
      justifyContent="between"
      maxWidth={300}
      width="100%"
    >
      <Icon iconName="heart" size="xs" type="solid" />
      <Icon iconName="heart" size="xs" type="regular" />

      <Icon iconName="heart" size="sm" type="solid" />
      <Icon iconName="heart" size="sm" type="regular" />

      <Icon iconName="heart" size="md" type="solid" />
      <Icon iconName="heart" size="md" type="regular" />

      <Icon iconName="heart" size="lg" type="solid" />
      <Icon iconName="heart" size="lg" type="regular" />

      <Icon iconName="heart" size="xl" type="solid" />
      <Icon iconName="heart" size="xl" type="regular" />
    </Box>
  </StorybookContainer>
);
