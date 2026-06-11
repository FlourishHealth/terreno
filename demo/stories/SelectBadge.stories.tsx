import {Badge, Box, SelectBadge, type SelectBadgeProps, Text} from "@terreno/ui";
import {useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

export const SelectBadgeDemo = (props: Partial<SelectBadgeProps>) => {
  const [value, setValue] = useState("option1");
  const sampleOptions = [
    {label: "Option 1", value: "option1"},
    {label: "Option 2", value: "option2"},
    {label: "Option 3", value: "option3"},
  ];
  return (
    <Box alignItems="center" justifyContent="center">
      <SelectBadge onChange={setValue} options={sampleOptions} value={value} {...props} />
    </Box>
  );
};

const BadgeLine = (text: string, badgeProps: Partial<SelectBadgeProps>) => {
  const [value, setValue] = useState("option1");
  const sampleOptions = [
    {label: "Option 1", value: "option1"},
    {label: "Option 2", value: "option2"},
    {label: "Option 3", value: "option3"},
  ];
  return (
    <Box direction="row" paddingY={2}>
      <Box width={100}>
        <SelectBadge onChange={setValue} options={sampleOptions} value={value} {...badgeProps} />
      </Box>
      <Box>
        <Text>{text}</Text>
      </Box>
    </Box>
  );
};

const statusOptions = [
  {label: "Active", value: "active"},
  {label: "Pending", value: "pending"},
  {label: "Inactive", value: "inactive"},
];

type BadgeStatus = "info" | "error" | "warning" | "success" | "neutral";

const ComparisonRow = ({label, status}: {label: string; status: BadgeStatus}) => {
  const [value, setValue] = useState("active");
  return (
    <Box alignItems="center" direction="row" gap={3} paddingY={2}>
      <Box width={80}>
        <Text size="sm">{label}</Text>
      </Box>
      <Badge status={status} value="Badge" />
      <SelectBadge onChange={setValue} options={statusOptions} status={status} value={value} />
    </Box>
  );
};

export const BadgeSelectBadgeComparison = () => {
  return (
    <StorybookContainer>
      <Box gap={1} paddingY={3}>
        <Text bold>Badge vs SelectBadge — size comparison</Text>
        <Text color="secondaryDark" size="sm">
          Both should be 20px tall and visually aligned.
        </Text>
      </Box>
      <ComparisonRow label="Info" status="info" />
      <ComparisonRow label="Success" status="success" />
      <ComparisonRow label="Warning" status="warning" />
      <ComparisonRow label="Error" status="error" />
      <ComparisonRow label="Neutral" status="neutral" />
      <Box gap={1} paddingY={3}>
        <Text bold>Secondary variants</Text>
      </Box>
      <Box alignItems="center" direction="row" gap={3} paddingY={2}>
        <Box width={80}>
          <Text size="sm">Secondary</Text>
        </Box>
        <Badge secondary status="info" value="Badge" />
        <SecondarySelectBadge />
      </Box>
    </StorybookContainer>
  );
};

const SecondarySelectBadge = () => {
  const [value, setValue] = useState("active");
  return (
    <SelectBadge
      onChange={setValue}
      options={statusOptions}
      secondary
      status="info"
      value={value}
    />
  );
};

export const SelectBadgeStories = () => {
  return (
    <StorybookContainer>
      <Box direction="column">
        {BadgeLine("Default", {})}
        {BadgeLine("Disabled", {disabled: true})}
        {BadgeLine("Secondary", {secondary: true})}
        {BadgeLine("Error", {status: "error"})}
        {BadgeLine("Warning", {status: "warning"})}
        {BadgeLine("Success", {status: "success"})}
        {BadgeLine("Neutral", {status: "neutral"})}
        {BadgeLine("Custom", {
          customBackgroundColor: "#FFD700",
          customBorderColor: "#007AFF",
          customTextColor: "#000000",
          status: "custom",
        })}
      </Box>
    </StorybookContainer>
  );
};
