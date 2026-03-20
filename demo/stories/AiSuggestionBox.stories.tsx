import type {AiSuggestionProps} from "@terreno/ui";
import {AiSuggestionBox, Box, Heading, TextArea} from "@terreno/ui";
import {type ReactElement, useCallback, useState} from "react";

const SAMPLE_TEXT =
  "The clinician used CBT techniques including cognitive restructuring and behavioral activation. Motivational interviewing was also employed to address ambivalence about treatment goals.";

const AiSuggestionDemo = ({
  initialStatus,
  text,
  label,
}: {
  initialStatus: AiSuggestionProps["status"];
  text?: string;
  label?: string;
}): ReactElement => {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [status, setStatus] = useState(initialStatus);

  const handleAdd = useCallback(() => {
    setValue((prev) => (prev ? `${prev}\n${text}` : (text ?? "")));
    setStatus("added");
  }, [text]);

  return (
    <Box gap={1} paddingY={2} width="100%">
      {Boolean(label) && <Heading size="sm">{label}</Heading>}
      <TextArea
        aiSuggestion={{
          feedback,
          onAdd: handleAdd,
          onFeedback: setFeedback,
          status,
          text,
        }}
        onChange={setValue}
        placeholder="Add your notes here..."
        rows={3}
        value={value}
      />
    </Box>
  );
};

export const AiSuggestionNotStarted = (): ReactElement => (
  <AiSuggestionDemo initialStatus="not-started" label="Not Started" />
);

export const AiSuggestionGenerating = (): ReactElement => (
  <AiSuggestionDemo initialStatus="generating" label="Generating" />
);

export const AiSuggestionReady = (): ReactElement => (
  <AiSuggestionDemo
    initialStatus="ready"
    label="Ready (click Add to note to see Added state)"
    text={SAMPLE_TEXT}
  />
);

export const AiSuggestionAdded = (): ReactElement => (
  <AiSuggestionDemo initialStatus="added" label="Added" text={SAMPLE_TEXT} />
);

export const AiSuggestionMainDemo = (): ReactElement => {
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);

  return (
    <AiSuggestionBox
      feedback={feedback}
      onAdd={() => {}}
      onFeedback={setFeedback}
      status="ready"
      text="AI generated note"
    />
  );
};

export const AiSuggestionAllStates = (): ReactElement => (
  <Box gap={4} padding={4} width="100%">
    <AiSuggestionNotStarted />
    <AiSuggestionGenerating />
    <AiSuggestionReady />
    <AiSuggestionAdded />
  </Box>
);
