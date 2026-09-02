export interface EvaluatorDimension {
  dataType: "boolean" | "categorical" | "numeric";
  key: string;
  range?: string;
  required: boolean;
}

export interface EvaluatorRunModes {
  allowManualRun: boolean;
  availableInExperiments: boolean;
  liveSampleRate: number;
}

export interface EvaluatorRecord {
  assertion?: {constraint: string; path: string};
  confidenceAlertBelow: number;
  description?: string;
  dimensions: EvaluatorDimension[];
  id: string;
  instructions?: string;
  judgePromptName?: string;
  name: string;
  runModes: EvaluatorRunModes;
  target: "dataset item" | "full trace" | "generation span";
  type: "human" | "json-assert" | "llm-judge";
}

export interface EvaluatorUsageRow {
  costUsd?: number;
  experimentId: string;
  experimentName: string;
  runs: number;
}

export const EVALUATOR_TYPE_LABELS: Record<EvaluatorRecord["type"], string> = {
  human: "Human",
  "json-assert": "JSON assert",
  "llm-judge": "LLM judge",
};

export const EVALUATOR_TARGET_OPTIONS: Array<{label: string; value: EvaluatorRecord["target"]}> = [
  {label: "Full trace", value: "full trace"},
  {label: "Generation span", value: "generation span"},
  {label: "Dataset item", value: "dataset item"},
];

export const DIMENSION_DATA_TYPES: EvaluatorDimension["dataType"][] = [
  "boolean",
  "numeric",
  "categorical",
];

export const emptyDimension = (): EvaluatorDimension => {
  return {
    dataType: "boolean",
    key: "",
    required: true,
  };
};

export const unwrapObservabilityPayload = <T>(raw: unknown): T | undefined => {
  if (raw == null) {
    return undefined;
  }
  if (typeof raw === "object" && "data" in raw) {
    return (raw as {data: T}).data;
  }
  return raw as T;
};

export const unwrapEvaluatorList = (raw: unknown): EvaluatorRecord[] => {
  const payload = unwrapObservabilityPayload<EvaluatorRecord[]>(raw);
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.filter((entry): entry is EvaluatorRecord => {
    return Boolean(entry && typeof entry.id === "string" && typeof entry.name === "string");
  });
};

export const unwrapEvaluatorRecord = (raw: unknown): EvaluatorRecord | undefined => {
  const payload = unwrapObservabilityPayload<EvaluatorRecord>(raw);
  if (!payload || typeof payload.id !== "string") {
    return undefined;
  }
  return payload;
};

export const formatDimensionSummary = (dimensions: EvaluatorDimension[]): string => {
  if (dimensions.length === 0) {
    return "—";
  }
  return dimensions.map((dimension) => dimension.key).join(", ");
};

export const formatRunModeChips = (runModes: EvaluatorRunModes): string[] => {
  const chips: string[] = [];
  if (runModes.allowManualRun) {
    chips.push("Manual");
  }
  if (runModes.availableInExperiments) {
    chips.push("Experiments");
  }
  if (runModes.liveSampleRate > 0) {
    chips.push(`Live ${Math.round(runModes.liveSampleRate)}%`);
  }
  return chips;
};

export const judgeSchemaMissingDimensions = (
  dimensions: EvaluatorDimension[],
  outputSchema?: Record<string, unknown>
): string[] => {
  const properties =
    outputSchema && typeof outputSchema.properties === "object"
      ? (outputSchema.properties as Record<string, unknown>)
      : {};
  return dimensions
    .filter((dimension) => {
      return dimension.required && properties[dimension.key] === undefined;
    })
    .map((dimension) => dimension.key);
};

export const parseApiErrorTitle = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const record = error as {data?: {title?: string}; message?: string};
  if (record.data?.title) {
    return record.data.title;
  }
  if (record.message) {
    return record.message;
  }
  return undefined;
};
