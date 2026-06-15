import {
  Box,
  Button,
  type CustomIconProps,
  Icon,
  IconButton,
  type IconProps,
  IconRegistryProvider,
  Text,
} from "@terreno/ui";
import Svg, {Path} from "react-native-svg";

import {StorybookContainer} from "./StorybookContainer";

// A custom icon is any component that accepts a resolved `color` and `size`.
const SparkleIcon = ({color, size, testID}: CustomIconProps) => (
  <Svg fill="none" height={size} testID={testID} viewBox="0 0 24 24" width={size}>
    <Path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" fill={color} />
  </Svg>
);

// Declaration merging gives type-safe, autocompleted custom icon names.
declare module "@terreno/ui" {
  interface CustomIconRegistry {
    sparkle: true;
  }
}

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
    <IconRegistryProvider icons={{sparkle: SparkleIcon}}>
      <Box gap={4} padding={6}>
        <Text>
          Register custom icons on TerrenoProvider (or a nested IconRegistryProvider) and use them
          by name anywhere an iconName is accepted.
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
    </IconRegistryProvider>
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
