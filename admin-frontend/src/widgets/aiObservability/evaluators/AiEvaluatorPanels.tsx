import {Badge, Box, Button, Heading, Link, Text, TextField} from "@terreno/ui";
import React, {useMemo} from "react";
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

const DIMENSION_COLUMNS = ["Key", "Data type", "Range", "Required"];

const USAGE_COLUMNS = ["Experiment", "30d runs", "Cost"];

/**
 * Flow-height table for the short, static lists on this screen. `DataTable` sizes itself to a
 * height-constrained parent, so inside this scrolling detail page it collapses and its border
 * overlaps the next section. These rows also stretch to the available width instead of leaving
 * a wide empty gutter beside fixed pixel columns.
 */
const DetailTable: React.FC<{
  columns: string[];
  rows: string[][];
  testID: string;
}> = ({columns, rows, testID}) => {
  return (
    <Box border="default" rounding="md" testID={testID}>
      <Box direction="row" gap={2} padding={3}>
        {columns.map((column) => {
          return (
            <Box flex="grow" key={column} minWidth={80}>
              <Text bold size="sm">
                {column}
              </Text>
            </Box>
          );
        })}
      </Box>
      {rows.map((row, rowIndex) => {
        return (
          <Box
            borderTop="default"
            direction="row"
            gap={2}
            key={row[0] ?? `row-${rowIndex}`}
            padding={3}
          >
            {row.map((cell, cellIndex) => {
              return (
                <Box flex="grow" key={columns[cellIndex] ?? `cell-${cellIndex}`} minWidth={80}>
                  <Text>{cell}</Text>
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};

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
              onChange={onAssertionPathChange ?? (() => undefined)}
              testID="ai-evaluator-assertion-path"
              title="Assertion path"
              value={assertionPath ?? ""}
            />
            <TextField
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
  const dimensionRows: string[][] = useMemo(() => {
    return evaluator.dimensions.map((dimension) => {
      return [
        dimension.key,
        dimension.dataType,
        dimension.range ?? "—",
        dimension.required ? "Yes" : "No",
      ];
    });
  }, [evaluator.dimensions]);

  const usageTableRows: string[][] = useMemo(() => {
    return usageRows.map((row) => {
      return [
        row.experimentName,
        String(row.runs),
        row.costUsd !== undefined ? `$${row.costUsd.toFixed(2)}` : "—",
      ];
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
        <DetailTable
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
          <DetailTable
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
      <TextField onChange={onNameChange} testID="ai-evaluator-name" title="Name" value={name} />
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
                onChange={(value) => {
                  onDimensionChange(index, {...dimension, key: value});
                }}
                title="Key"
                value={dimension.key}
              />
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
              <TextField
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
