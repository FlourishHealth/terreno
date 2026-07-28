import {
  BinaryFeedback,
  type BinaryFeedbackProps,
  type BinaryFeedbackValue,
  Box,
  Text,
} from "@terreno/ui";
import {useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

export const BinaryFeedbackDemo = (props: Partial<BinaryFeedbackProps>) => {
  const [value, setValue] = useState<BinaryFeedbackValue | undefined>(undefined);

  return (
    <Box alignItems="center" justifyContent="center">
      <BinaryFeedback onChange={setValue} value={value} {...props} />
    </Box>
  );
};

const FeedbackLine = ({text, ...feedbackProps}: {text: string} & Partial<BinaryFeedbackProps>) => {
  const [value, setValue] = useState<BinaryFeedbackValue | undefined>(feedbackProps.value);

  return (
    <Box alignItems="center" direction="row" gap={4} paddingY={2}>
      <Box width={100}>
        <BinaryFeedback onChange={setValue} {...feedbackProps} value={value} />
      </Box>
      <Text>{text}</Text>
    </Box>
  );
};

export const BinaryFeedbackStories = () => {
  return (
    <StorybookContainer>
      <Box direction="column">
        <FeedbackLine text="No selection" />
        <FeedbackLine text="Positive selected" value="positive" />
        <FeedbackLine text="Negative selected" value="negative" />
        <FeedbackLine disabled text="Disabled" />
        <FeedbackLine disabled text="Disabled with selection" value="positive" />
        <FeedbackLine size="sm" text="Small" />
        <FeedbackLine size="md" text="Medium (default)" />
        <FeedbackLine size="lg" text="Large" />
      </Box>
    </StorybookContainer>
  );
};

export const BinaryFeedbackWithConfirmation = () => {
  const [value, setValue] = useState<BinaryFeedbackValue | undefined>(undefined);

  let message = "Was this helpful?";
  if (value === "positive") {
    message = "Thanks for the feedback!";
  } else if (value === "negative") {
    message = "Thanks — we'll use this to improve.";
  }

  return (
    <StorybookContainer>
      <Box alignItems="center" direction="row" gap={4}>
        <Text>{message}</Text>
        <BinaryFeedback onChange={setValue} testID="binary-feedback-inline" value={value} />
      </Box>
    </StorybookContainer>
  );
};
