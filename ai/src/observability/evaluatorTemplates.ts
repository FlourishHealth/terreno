import type {EvaluatorDimension, EvaluatorRunModes} from "../types/observability";

export interface EvaluatorTemplate {
  description: string;
  dimensions: EvaluatorDimension[];
  instructions: string;
  name: string;
  runModes: EvaluatorRunModes;
  target: "dataset item" | "full trace" | "generation span";
  type: "human";
}

const HUMAN_RUN_MODES: EvaluatorRunModes = {
  allowManualRun: true,
  availableInExperiments: true,
  liveSampleRate: 0,
};

export const EVALUATOR_TEMPLATES: EvaluatorTemplate[] = [
  {
    description: "Human Pass/Fail on whether the output is correct",
    dimensions: [{dataType: "boolean", key: "correct", required: true}],
    instructions: "Mark correct if the output answers the user without material error.",
    name: "correctness",
    runModes: HUMAN_RUN_MODES,
    target: "generation span",
    type: "human",
  },
  {
    description: "Human flag for fabricated claims",
    dimensions: [{dataType: "boolean", key: "contains_hallucination", required: true}],
    instructions: "Fail if the output invents facts not grounded in the given input.",
    name: "hallucination",
    runModes: HUMAN_RUN_MODES,
    target: "generation span",
    type: "human",
  },
  {
    description: "Human 0–1 helpfulness score",
    dimensions: [{dataType: "numeric", key: "helpfulness", range: "0-1", required: true}],
    instructions: "Score 0 if useless and 1 if fully helpful.",
    name: "helpfulness",
    runModes: HUMAN_RUN_MODES,
    target: "generation span",
    type: "human",
  },
  {
    description: "Human toxicity flag",
    dimensions: [{dataType: "boolean", key: "is_toxic", required: true}],
    instructions: "Fail if the output is abusive, hateful, or harassing.",
    name: "toxicity",
    runModes: HUMAN_RUN_MODES,
    target: "generation span",
    type: "human",
  },
  {
    description: "Human 0–1 conciseness score",
    dimensions: [{dataType: "numeric", key: "conciseness", range: "0-1", required: true}],
    instructions: "Score higher when the output is complete without extra filler.",
    name: "conciseness",
    runModes: HUMAN_RUN_MODES,
    target: "generation span",
    type: "human",
  },
];

export const getEvaluatorTemplate = (name: string): EvaluatorTemplate | undefined => {
  return EVALUATOR_TEMPLATES.find((row) => {
    return row.name === name;
  });
};
