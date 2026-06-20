import type {CustomIconProps, IconRegistryMap} from "@terreno/ui";
import Svg, {Path} from "react-native-svg";

// A custom icon is any component that accepts a resolved `color` and `size`.
export const SparkleIcon = ({color, size, testID}: CustomIconProps): React.ReactElement => (
  <Svg fill="none" height={size} testID={testID} viewBox="0 0 24 24" width={size}>
    <Path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" fill={color} />
  </Svg>
);

// Custom icons registered on the root TerrenoProvider, usable by name anywhere
// an `iconName` is accepted (Icon, Button, IconButton, fields, etc.).
export const customIcons: IconRegistryMap = {
  sparkle: SparkleIcon,
};

// Declaration merging gives type-safe, autocompleted custom icon names.
declare module "@terreno/ui" {
  interface CustomIconRegistry {
    sparkle: true;
  }
}
