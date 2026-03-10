import {Box, Button, Heading, SelectField, Text, TextField} from "@terreno/ui";
import React, {useState} from "react";
import type {ScoreSubmission, ScoringFunction} from "../../backend/types";
import {useEvaluation} from "../hooks/useEvaluation";

interface EvaluationFormProps {
  traceId: string;
  scoringFunctions?: ScoringFunction[];
  onSubmitted?: () => void;
}

export const EvaluationForm: React.FC<EvaluationFormProps> = ({
  traceId,
  scoringFunctions = [],
  onSubmitted,
}) => {
  const {submit, isSubmitting, error} = useEvaluation();
  const [selectedFunction, setSelectedFunction] = useState(scoringFunctions[0]?.name ?? "");
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const activeFn = scoringFunctions.find((f) => f.name === selectedFunction);

  const getDataType = (fn?: ScoringFunction): ScoreSubmission["dataType"] => {
    if (!fn) {
      return "NUMERIC";
    }
    if (fn.scoreType === "numeric") {
      return "NUMERIC";
    }
    if (fn.scoreType === "categorical") {
      return "CATEGORICAL";
    }
    return "BOOLEAN";
  };

  const handleSubmit = async (): Promise<void> => {
    const dataType = getDataType(activeFn);
    const parsedValue = dataType === "NUMERIC" ? parseFloat(value) : value;

    await submit({
      comment: comment || undefined,
      dataType,
      name: selectedFunction || "score",
      traceId,
      value: parsedValue,
    });

    setSubmitted(true);
    onSubmitted?.();
  };

  if (submitted) {
    return (
      <Box padding={3}>
        <Text color="success">Evaluation submitted successfully.</Text>
      </Box>
    );
  }

  const categoryOptions = activeFn?.categories?.map((c) => ({label: c, value: c})) ?? [];

  return (
    <Box gap={3}>
      <Heading size="sm">Submit Evaluation</Heading>

      {scoringFunctions.length > 0 && (
        <SelectField
          onChange={setSelectedFunction}
          options={scoringFunctions.map((f) => ({label: f.name, value: f.name}))}
          title="Scoring Function"
          value={selectedFunction}
        />
      )}

      {activeFn?.scoreType === "categorical" && categoryOptions.length > 0 ? (
        <SelectField onChange={setValue} options={categoryOptions} title="Value" value={value} />
      ) : (
        <TextField
          onChange={setValue}
          placeholder={activeFn?.scoreType === "boolean" ? "true or false" : "numeric value"}
          title="Value"
          value={value}
        />
      )}

      <TextField
        multiline
        onChange={setComment}
        rows={2}
        title="Comment (optional)"
        value={comment}
      />

      {error && <Text color="error">{error}</Text>}

      <Button
        disabled={!value}
        loading={isSubmitting}
        onClick={handleSubmit}
        text="Submit"
        variant="primary"
      />
    </Box>
  );
};
