import {
  Box,
  Popover,
  type PopoverProps,
  type PopoverStatus,
  Text,
  type ThumbsUpDownFeedbackValue,
} from "@terreno/ui";
import React, {useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

const SUMMARY =
  "Summary of Patient History:\n[Patient Name] is a [Age] y/o [ethnicity] [gender (pronouns: [stated pronoun])], referred to Flourish for [following] [referral context] and began Flourish treatment on [date]. [Pronoun] has undefined diagnoses and is currently on no documented medications. [Pronoun] currently [state living conditions] and [state school/work status]. [Pronoun]'s social support system includes [brief overview]. [Pronoun] enjoys [hobby # 1, interest # 2, any other fun fact that can be used for rapport building].\n\nEngagement Details:\n- Psychiatry: Intake scheduled for Friday, November 7th, from 4:30-5:50 PM ET.\n- Therapy: Therapy sessions are weekly, with the schedule to be determined by the patient guide.\n- Patient Guiding: Scheduled for chat support on Tuesdays and Thursdays.";

export const PopoverDemo = (props: Partial<PopoverProps>) => {
  const [visible, setVisible] = useState(true);
  const [feedback, setFeedback] = useState<ThumbsUpDownFeedbackValue | undefined>(undefined);

  if (!visible) {
    return (
      <Box alignItems="center" justifyContent="center">
        <Text color="secondaryLight">Popover closed. Reload the demo to show it again.</Text>
      </Box>
    );
  }

  return (
    <Box alignItems="center" justifyContent="center">
      <Popover
        feedback={feedback}
        onClose={() => setVisible(false)}
        onFeedbackChange={setFeedback}
        onOpen={() => console.info("Open document")}
        onRetry={() => console.info("Retry loading document")}
        subtitle="11/20/2026"
        text={SUMMARY}
        title="Document Title"
        {...props}
      />
    </Box>
  );
};

const StatefulPopover = ({label, status}: {label: string; status: PopoverStatus}) => {
  const [feedback, setFeedback] = useState<ThumbsUpDownFeedbackValue | undefined>(undefined);

  return (
    <Box direction="column" gap={2}>
      <Text bold size="sm">
        {label}
      </Text>
      <Popover
        feedback={feedback}
        onClose={() => console.info("Close document")}
        onFeedbackChange={setFeedback}
        onOpen={() => console.info("Open document")}
        onRetry={() => console.info("Retry loading document")}
        status={status}
        subtitle="11/20/2026"
        text={SUMMARY}
        title="Document Title"
      />
    </Box>
  );
};

export const PopoverStories = () => {
  return (
    <StorybookContainer>
      <Box direction="column" gap={6}>
        <StatefulPopover label="Loaded" status="loaded" />
        <StatefulPopover label="Loading" status="loading" />
        <StatefulPopover label="Error" status="error" />
      </Box>
    </StorybookContainer>
  );
};

export const PopoverWithoutFooter = () => {
  return (
    <StorybookContainer>
      <Popover
        onClose={() => console.info("Close document")}
        subtitle="11/20/2026"
        text={SUMMARY}
        title="Document Title"
      />
    </StorybookContainer>
  );
};
