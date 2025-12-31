import {Badge, type BadgeProps, Box, Text} from "ferns-ui";

import {StorybookContainer} from "./StorybookContainer";

export const BadgeDemo = (props: Partial<BadgeProps>) => {
  return (
    <Box alignItems="center" justifyContent="center">
      <Badge iconName="check" status="info" value="Default" {...props} />
    </Box>
  );
};

function badgeLine(text: string, badgeProps: Partial<BadgeProps>) {
  return (
    <Box direction="row" paddingY={2}>
      <Box width={100}>
        <Badge iconName="check" {...badgeProps} />
      </Box>
      <Box>
        <Text>{text}</Text>
      </Box>
    </Box>
  );
}

export const BadgeStories = () => {
  return (
    <StorybookContainer>
      <Box direction="column">
        {badgeLine("Default", {value: "Default"})}
        {badgeLine("Icon Only", {variant: "iconOnly"})}
        {badgeLine("Number Only", {value: "10", variant: "numberOnly"})}
        {badgeLine("Secondary Default", {secondary: true, value: "Default"})}
        {badgeLine("Secondary Icon Only", {
          secondary: true,
          variant: "iconOnly",
        })}
        {badgeLine("Secondary Number Only", {
          secondary: true,
          value: "5",
          variant: "numberOnly",
        })}

        {badgeLine("Error", {status: "error", value: "Failed"})}
        {badgeLine("Error Icon Only", {status: "error", value: "Failed", variant: "iconOnly"})}
        {badgeLine("Error Number Only", {status: "error", value: "10", variant: "numberOnly"})}
        {badgeLine("Error Secondary", {secondary: true, status: "error", value: "Failed"})}
        {badgeLine("Error Secondary Icon Only", {
          secondary: true,
          status: "error",
          value: "Failed",
          variant: "iconOnly",
        })}
        {badgeLine("Error Secondary Number Only", {
          secondary: true,
          status: "error",
          value: "5",
          variant: "numberOnly",
        })}

        {badgeLine("Warning", {status: "warning", value: "Failed"})}
        {badgeLine("Warning Icon Only", {status: "warning", value: "Failed", variant: "iconOnly"})}
        {badgeLine("Warning Number Only", {status: "warning", value: "10", variant: "numberOnly"})}
        {badgeLine("Warning Secondary", {secondary: true, status: "warning", value: "Failed"})}
        {badgeLine("Warning Secondary Icon Only", {
          secondary: true,
          status: "warning",
          value: "Failed",
          variant: "iconOnly",
        })}
        {badgeLine("Warning Secondary Number Only", {
          secondary: true,
          status: "warning",
          value: "5",
          variant: "numberOnly",
        })}
        {badgeLine("Success", {status: "success", value: "Failed"})}
        {badgeLine("Success Icon Only", {status: "success", value: "Failed", variant: "iconOnly"})}
        {badgeLine("Success Number Only", {status: "success", value: "10", variant: "numberOnly"})}
        {badgeLine("Success Secondary", {secondary: true, status: "success", value: "Failed"})}
        {badgeLine("Success Secondary Icon Only", {
          secondary: true,
          status: "success",
          value: "Failed",
          variant: "iconOnly",
        })}
        {badgeLine("Success Secondary Number Only", {
          secondary: true,
          status: "success",
          value: "5",
          variant: "numberOnly",
        })}
        {badgeLine("Neutral", {status: "neutral", value: "Failed"})}
        {badgeLine("Neutral Icon Only", {status: "neutral", value: "Failed", variant: "iconOnly"})}
        {badgeLine("Neutral Number Only", {status: "neutral", value: "10", variant: "numberOnly"})}
        {badgeLine("Neutral Secondary", {secondary: true, status: "neutral", value: "Failed"})}
        {badgeLine("Neutral Secondary Icon Only", {
          secondary: true,
          status: "neutral",
          value: "Failed",
          variant: "iconOnly",
        })}
        {badgeLine("Neutral Secondary Nubmer Only", {
          secondary: true,
          status: "neutral",
          value: "5",
          variant: "numberOnly",
        })}

        {badgeLine("Custom", {
          customBackgroundColor: "#FFA6C9",
          customTextColor: "#FFFFFF",
          status: "custom",
          value: "Custom",
        })}
        {badgeLine("Custom Icon Only", {
          customBackgroundColor: "#FFA6C9",
          status: "custom",
          value: "Failed",
          variant: "iconOnly",
        })}
        {badgeLine("Custom Number Only", {
          customBackgroundColor: "#FFA6C9",
          status: "custom",
          value: "10",
          variant: "numberOnly",
        })}
        {badgeLine("Custom Secondary", {
          customBackgroundColor: "#FFA6C9",
          secondary: true,
          status: "custom",
          value: "Failed",
        })}
        {badgeLine("Custom Secondary Icon Only", {
          customBackgroundColor: "#FFA6C9",
          secondary: true,
          status: "custom",
          value: "Failed",
          variant: "iconOnly",
        })}
        {badgeLine("Custom Secondary Nubmer Only", {
          customBackgroundColor: "#FFA6C9",
          secondary: true,
          status: "custom",
          value: "5",
          variant: "numberOnly",
        })}
        {badgeLine("Custom Secondary Font And Border", {
          customBackgroundColor: "#FFA6C9",
          customBorderColor: "#6600CC",
          customIconColor: "success",
          customIconName: "user-astronaut",
          customTextColor: "#6600CC",
          secondary: true,
          status: "custom",
          value: "Very Custom!",
        })}
      </Box>
    </StorybookContainer>
  );
};
