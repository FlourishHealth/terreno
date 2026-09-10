import {Badge, Box, Button, Heading, Link, Text, TextField} from "@terreno/ui";
import React, {useMemo} from "react";
import {
  ObservabilityTable,
  type ObservabilityTableColumn,
  type ObservabilityTableRow,
} from "../shell/ObservabilityTable";
import {
  DIMENSION_DATA_TYPES,
  EVALUATOR_TARGET_OPTIONS,
  EVALUATOR_TYPE_LABELS,
  type EvaluatorDimension,
  type EvaluatorRecord,
  type EvaluatorUsageRow,
  emptyDimension,
  formatRunModeChips,
  judgeSchemaMissingDimensions,
} from "./evaluatorTypes";

export const EVALUATOR_NEW_INTRO =
  "An evaluator scores traces and experiment outputs. Each score is a named dimension (boolean, numeric, or categorical). Attach the same evaluator to experiments, live sampling, or the human review queue.";

export const EVALUATOR_TYPE_HELP: Record<EvaluatorRecord["type"], string> = {
  human:
    "A person scores items in Human review. Scores wait in the queue until a reviewer submits them. Live sampling is not allowed.",
  "json-assert":
    "Terreno checks a JSON path on the target against a constraint. No model call. Use for schema presence, enums, or numeric thresholds.",
  "llm-judge":
    "Terreno calls a registered prompt whose outputSchema must include every required dimension key. Each run is a billed model call.",
};

export const EVALUATOR_TARGET_HELP: Record<EvaluatorRecord["target"], string> = {
  "dataset item":
    "Score one dataset row during an experiment (input, expected output, and model output).",
  "full trace": "Score the whole trace: nested spans, the compiled prompt, and the final output.",
  "generation span": "Score one generation span (one model call) instead of the whole trace.",
};

const EVALUATOR_NAME_HELP =
  "Stable id used in lists, experiments, and score rows. Lowercase kebab-case, unique in this app.";

const EVALUATOR_DIMENSIONS_HELP =
  "Each dimension is one score written onto traces and experiment items. Keys must match llm-judge outputSchema properties. At least one dimension is required.";

const EVALUATOR_DIMENSION_KEY_HELP = "Score name stored on results, e.g. correct or toxicity.";

const EVALUATOR_DIMENSION_RANGE_HELP =
  "Optional. For numeric scores, e.g. 0-1. Leave blank for boolean.";

const EVALUATOR_INSTRUCTIONS_HELP =
  "Shown at the top of the review item. Tell the reviewer what pass/fail means and which failure modes to watch for.";

const EVALUATOR_ASSERTION_PATH_HELP =
  "Dot path into the target JSON, e.g. output.text or output.score. The value at this path is what the constraint checks.";

const EVALUATOR_ASSERTION_CONSTRAINT_HELP =
  "How to check the path. Use exists, a literal match, or a numeric compare such as gte 0.8.";

const EVALUATOR_JUDGE_PROMPT_HELP =
  "Name of a prompt already saved in Observability. Its production outputSchema must declare every required dimension key.";

const EVALUATOR_LIVE_SAMPLE_HELP =
  "0 means off. Greater than 0 runs this evaluator on that percent of matching production traffic. Human evaluators must stay at 0.";

export interface AiEvaluatorDetailViewProps {
  evaluator: EvaluatorRecord;
  judgeOutputSchema?: Record<string, unknown>;
  onOpenPrompt?: (name: string) => void;
  routeBase: string;
  usageRows: EvaluatorUsageRow[];
}

export interface AiEvaluatorNewViewProps {
  assertionConstraint: string;
  assertionPath: string;
  createError?: string;
  dimensions: EvaluatorDimension[];
  instructions: string;
  isCreating: boolean;
  judgePromptName: string;
  name: string;
  onAddDimension: () => void;
  onAssertionConstraintChange: (value: string) => void;
  onAssertionPathChange: (value: string) => void;
  onCreate: () => void;
  onDimensionChange: (index: number, dimension: EvaluatorDimension) => void;
  onInstructionsChange: (value: string) => void;
  onJudgePromptNameChange: (value: string) => void;
  onLiveSampleRateChange: (value: number) => void;
  onNameChange: (value: string) => void;
  onRemoveDimension: (index: number) => void;
  onTargetChange: (value: EvaluatorRecord["target"]) => void;
  onTypeChange: (value: EvaluatorRecord["type"]) => void;
  runModes: EvaluatorRecord["runModes"];
  schemaMismatchKey?: string;
  target: EvaluatorRecord["target"];
  type: EvaluatorRecord["type"];
}

const DIMENSION_COLUMNS: ObservabilityTableColumn[] = [
  {minWidth: 120, title: "Key"},
  {minWidth: 100, title: "Data type"},
  {minWidth: 80, title: "Range"},
  {minWidth: 80, title: "Required"},
];

const USAGE_COLUMNS: ObservabilityTableColumn[] = [
  {minWidth: 160, title: "Experiment"},
  {minWidth: 90, title: "30d runs"},
  {minWidth: 90, title: "Cost"},
];

const renderTypePanel = ({
  assertionConstraint,
  assertionPath,
  evaluator,
  evaluatorType,
  judgeOutputSchema,
  instructions,
  judgePromptName,
  onAssertionConstraintChange,
  onAssertionPathChange,
  onInstructionsChange,
  onJudgePromptNameChange,
  onOpenPrompt,
  routeBase,
  schemaMismatchKey,
}: {
  assertionConstraint?: string;
  assertionPath?: string;
  evaluator?: EvaluatorRecord;
  evaluatorType?: EvaluatorRecord["type"];
  judgeOutputSchema?: Record<string, unknown>;
  instructions?: string;
  judgePromptName?: string;
  onAssertionConstraintChange?: (value: string) => void;
  onAssertionPathChange?: (value: string) => void;
  onInstructionsChange?: (value: string) => void;
  onJudgePromptNameChange?: (value: string) => void;
  onOpenPrompt?: (name: string) => void;
  routeBase?: string;
  schemaMismatchKey?: string;
}): React.ReactNode => {
  const type = evaluator?.type ?? evaluatorType;
  if (type === "llm-judge") {
    const missing = judgeSchemaMissingDimensions(evaluator?.dimensions ?? [], judgeOutputSchema);
    const mismatch = schemaMismatchKey ?? missing[0];
    return (
      <Box gap={2} testID="ai-evaluator-panel-llm-judge">
        {evaluator ? (
          <Box direction="row" gap={2} wrap>
            <Text>
              Judge prompt:{" "}
              {evaluator.judgePromptName ? (
                onOpenPrompt ? (
                  <Button
                    onClick={() => {
                      onOpenPrompt(evaluator.judgePromptName ?? "");
                    }}
                    size="sm"
                    text={evaluator.judgePromptName}
                    variant="ghost"
                  />
                ) : (
                  <Link
                    href={`${routeBase}/ai-prompt-editor?name=${encodeURIComponent(evaluator.judgePromptName)}`}
                    text={evaluator.judgePromptName}
                  />
                )
              ) : (
                "—"
              )}
            </Text>
          </Box>
        ) : (
          <TextField
            helperText={EVALUATOR_JUDGE_PROMPT_HELP}
            onChange={onJudgePromptNameChange ?? (() => undefined)}
            testID="ai-evaluator-judge-prompt"
            title="Judge prompt name"
            value={judgePromptName ?? ""}
          />
        )}
        {mismatch ? (
          <Text color="error" testID="ai-evaluator-schema-mismatch">
            Judge prompt output schema missing required dimension &quot;{mismatch}&quot;
          </Text>
        ) : (
          <Text color="success" size="sm">
            Schema match check passed
          </Text>
        )}
      </Box>
    );
  }
  if (type === "json-assert") {
    return (
      <Box gap={2} testID="ai-evaluator-panel-json-assert">
        {evaluator ? (
          <Box gap={1}>
            <Text>
              Path: <Text bold>{evaluator.assertion?.path ?? "—"}</Text>
            </Text>
            <Text>
              Constraint: <Text bold>{evaluator.assertion?.constraint ?? "—"}</Text>
            </Text>
          </Box>
        ) : (
          <>
            <TextField
              helperText={EVALUATOR_ASSERTION_PATH_HELP}
              onChange={onAssertionPathChange ?? (() => undefined)}
              testID="ai-evaluator-assertion-path"
              title="Assertion path"
              value={assertionPath ?? ""}
            />
            <TextField
              helperText={EVALUATOR_ASSERTION_CONSTRAINT_HELP}
              onChange={onAssertionConstraintChange ?? (() => undefined)}
              testID="ai-evaluator-assertion-constraint"
              title="Constraint"
              value={assertionConstraint ?? ""}
            />
          </>
        )}
      </Box>
    );
  }
  return (
    <Box gap={2} testID="ai-evaluator-panel-human">
      {evaluator ? (
        <Text>{evaluator.instructions ?? "No reviewer instructions."}</Text>
      ) : (
        <TextField
          helperText={EVALUATOR_INSTRUCTIONS_HELP}
          multiline
          onChange={onInstructionsChange ?? (() => undefined)}
          rows={4}
          testID="ai-evaluator-instructions"
          title="Reviewer instructions"
          value={instructions ?? ""}
        />
      )}
    </Box>
  );
};

export const AiEvaluatorDetailView: React.FC<AiEvaluatorDetailViewProps> = ({
  evaluator,
  judgeOutputSchema,
  onOpenPrompt,
  routeBase,
  usageRows,
}) => {
  const dimensionRows: ObservabilityTableRow[] = useMemo(() => {
    return evaluator.dimensions.map((dimension, index) => {
      return {
        cells: [
          dimension.key,
          dimension.dataType,
          dimension.range ?? "—",
          dimension.required ? "Yes" : "No",
        ],
        key: dimension.key || `dimension-${index}`,
      };
    });
  }, [evaluator.dimensions]);

  const usageTableRows: ObservabilityTableRow[] = useMemo(() => {
    return usageRows.map((row, index) => {
      return {
        cells: [
          row.experimentName,
          String(row.runs),
          row.costUsd !== undefined ? `$${row.costUsd.toFixed(2)}` : "—",
        ],
        key: row.experimentId ?? `usage-${index}`,
      };
    });
  }, [usageRows]);

  const chips = formatRunModeChips(evaluator.runModes);

  return (
    <Box gap={4} testID="ai-evaluator-detail">
      <Box gap={2}>
        <Heading size="md" testID="ai-evaluator-name">
          {evaluator.name}
        </Heading>
        {evaluator.description ? (
          <Text color="secondaryDark">{evaluator.description}</Text>
        ) : undefined}
        <Box direction="row" gap={2} wrap>
          <Badge status="info" value={EVALUATOR_TYPE_LABELS[evaluator.type]} />
          <Badge status="neutral" value={evaluator.target} />
          {chips.map((chip) => {
            return <Badge key={chip} status="neutral" value={chip} />;
          })}
        </Box>
      </Box>
      <Box gap={2}>
        <Heading size="sm">Dimensions</Heading>
        <ObservabilityTable
          columns={DIMENSION_COLUMNS}
          rows={dimensionRows}
          testID="ai-evaluator-dimensions"
        />
      </Box>
      <Box gap={2}>
        <Heading size="sm">Type-specific config</Heading>
        {renderTypePanel({
          evaluator,
          judgeOutputSchema,
          onOpenPrompt,
          routeBase,
        })}
      </Box>
      <Box gap={2}>
        <Heading size="sm">Run modes</Heading>
        <Text size="sm">
          Live sampling at {Math.round(evaluator.runModes.liveSampleRate)}% bills judge calls on
          matching traffic.
        </Text>
      </Box>
      <Box gap={2}>
        <Heading size="sm">Used by (30 days)</Heading>
        {usageRows.length === 0 ? (
          <Text color="secondaryDark" testID="ai-evaluator-used-by-empty">
            No experiments in the last 30 days.
          </Text>
        ) : (
          <ObservabilityTable
            columns={USAGE_COLUMNS}
            rows={usageTableRows}
            testID="ai-evaluator-used-by"
          />
        )}
      </Box>
    </Box>
  );
};

export const AiEvaluatorNewView: React.FC<AiEvaluatorNewViewProps> = ({
  assertionConstraint,
  assertionPath,
  createError,
  dimensions,
  instructions,
  isCreating,
  judgePromptName,
  name,
  onAddDimension,
  onAssertionConstraintChange,
  onAssertionPathChange,
  onCreate,
  onDimensionChange,
  onInstructionsChange,
  onJudgePromptNameChange,
  onLiveSampleRateChange,
  onNameChange,
  onRemoveDimension,
  onTargetChange,
  onTypeChange,
  runModes,
  schemaMismatchKey,
  target,
  type,
}) => {
  const handleTypeSelect = (next: EvaluatorRecord["type"]): void => {
    onTypeChange(next);
  };

  return (
    <Box gap={4} testID="ai-evaluator-new">
      <Box border="default" gap={2} padding={4} rounding="md" testID="ai-evaluator-help-intro">
        <Heading size="sm">What is an evaluator?</Heading>
        <Text color="secondaryDark">{EVALUATOR_NEW_INTRO}</Text>
      </Box>
      <TextField
        helperText={EVALUATOR_NAME_HELP}
        onChange={onNameChange}
        testID="ai-evaluator-name"
        title="Name"
        value={name}
      />
      <Box gap={2}>
        <Text bold>Type</Text>
        <Box direction="row" gap={2} wrap>
          {(["human", "json-assert", "llm-judge"] as const).map((entry) => {
            return (
              <Button
                key={entry}
                onClick={() => {
                  handleTypeSelect(entry);
                }}
                testID={`ai-evaluator-type-${entry}`}
                text={EVALUATOR_TYPE_LABELS[entry]}
                variant={type === entry ? "primary" : "secondary"}
              />
            );
          })}
        </Box>
        <Text color="secondaryDark" size="sm" testID="ai-evaluator-help-type">
          {EVALUATOR_TYPE_HELP[type]}
        </Text>
      </Box>
      <Box gap={2}>
        <Text bold>Target</Text>
        <Box direction="row" gap={2} wrap>
          {EVALUATOR_TARGET_OPTIONS.map((option) => {
            return (
              <Button
                key={option.value}
                onClick={() => {
                  onTargetChange(option.value);
                }}
                testID={`ai-evaluator-target-${option.value.replace(/\s+/g, "-")}`}
                text={option.label}
                variant={target === option.value ? "primary" : "secondary"}
              />
            );
          })}
        </Box>
        <Text color="secondaryDark" size="sm" testID="ai-evaluator-help-target">
          {EVALUATOR_TARGET_HELP[target]}
        </Text>
      </Box>
      <Box gap={2}>
        <Box direction="row" gap={2} justifyContent="between">
          <Text bold>Dimensions</Text>
          <Button
            onClick={onAddDimension}
            testID="ai-evaluator-add-dimension"
            text="Add dimension"
          />
        </Box>
        <Text color="secondaryDark" size="sm" testID="ai-evaluator-help-dimensions">
          {EVALUATOR_DIMENSIONS_HELP}
        </Text>
        {dimensions.map((dimension, index) => {
          return (
            <Box
              color="secondaryLight"
              direction="row"
              gap={2}
              key={`dimension-${index}`}
              padding={2}
              testID={`ai-evaluator-dimension-row-${index}`}
              wrap
            >
              <TextField
                helperText={EVALUATOR_DIMENSION_KEY_HELP}
                onChange={(value) => {
                  onDimensionChange(index, {...dimension, key: value});
                }}
                title="Key"
                value={dimension.key}
              />
              <Box gap={1}>
                <Text size="sm">Data type</Text>
                <Box direction="row" gap={1} wrap>
                  {DIMENSION_DATA_TYPES.map((dataType) => {
                    return (
                      <Button
                        key={dataType}
                        onClick={() => {
                          onDimensionChange(index, {...dimension, dataType});
                        }}
                        text={dataType}
                        variant={dimension.dataType === dataType ? "primary" : "ghost"}
                      />
                    );
                  })}
                </Box>
                <Text color="secondaryDark" size="sm">
                  boolean is pass/fail, numeric is a number, categorical is a labeled bucket.
                </Text>
              </Box>
              <TextField
                helperText={EVALUATOR_DIMENSION_RANGE_HELP}
                onChange={(value) => {
                  onDimensionChange(index, {...dimension, range: value});
                }}
                title="Range"
                value={dimension.range ?? ""}
              />
              <Button
                onClick={() => {
                  onRemoveDimension(index);
                }}
                text="Remove"
                variant="ghost"
              />
            </Box>
          );
        })}
      </Box>
      {renderTypePanel({
        assertionConstraint,
        assertionPath,
        evaluatorType: type,
        instructions,
        judgePromptName,
        onAssertionConstraintChange,
        onAssertionPathChange,
        onInstructionsChange,
        onJudgePromptNameChange,
        schemaMismatchKey,
      })}
      <Box gap={2}>
        <Text bold>Run modes</Text>
        <TextField
          helperText={EVALUATOR_LIVE_SAMPLE_HELP}
          onChange={(value) => {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
              onLiveSampleRateChange(Math.min(100, Math.max(0, parsed)));
            }
          }}
          testID="ai-evaluator-live-sample"
          title="Live sample rate (%)"
          value={String(Math.round(runModes.liveSampleRate))}
        />
        {runModes.liveSampleRate > 0 ? (
          <Text color="warning" size="sm">
            Live sampling bills judge calls on production traffic.
          </Text>
        ) : undefined}
      </Box>
      {createError ? (
        <Text color="error" testID="ai-evaluator-create-error">
          {createError}
        </Text>
      ) : undefined}
      <Button
        loading={isCreating}
        onClick={onCreate}
        testID="ai-evaluator-submit"
        text="Create evaluator"
      />
    </Box>
  );
};

export const defaultEvaluatorRunModes = (): EvaluatorRecord["runModes"] => {
  return {
    allowManualRun: true,
    availableInExperiments: true,
    liveSampleRate: 0,
  };
};

export const initialNewEvaluatorDimensions = (): EvaluatorDimension[] => {
  return [emptyDimension()];
};
