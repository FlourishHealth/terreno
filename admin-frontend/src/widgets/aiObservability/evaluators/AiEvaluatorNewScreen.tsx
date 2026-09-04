import {router} from "expo-router";
import React, {useCallback, useMemo, useState} from "react";
import type {AdminScreenWidgetProps} from "../../../types";
import {unwrapPromptDetail} from "../prompts/promptTypes";
import {useAiObservabilityPromptsApi} from "../prompts/useAiObservabilityPromptsApi";
import {AiObservabilityChrome} from "../shell/AiObservabilityChrome";
import {
  AiEvaluatorNewView,
  defaultEvaluatorRunModes,
  initialNewEvaluatorDimensions,
} from "./AiEvaluatorPanels";
import {
  type EvaluatorDimension,
  type EvaluatorRecord,
  judgeSchemaMissingDimensions,
  parseApiErrorTitle,
} from "./evaluatorTypes";
import {useAiObservabilityEvaluatorsApi} from "./useAiObservabilityEvaluatorsApi";

export const AiEvaluatorNewScreenWidget: React.FC<AdminScreenWidgetProps> = (props) => {
  const {api, routeBase} = props;
  const {useCreateMutation} = useAiObservabilityEvaluatorsApi(api);
  const {useDetailQuery: usePromptDetailQuery} = useAiObservabilityPromptsApi(api);
  const [createEvaluator, createState] = useCreateMutation();
  const [name, setName] = useState("");
  const [type, setType] = useState<EvaluatorRecord["type"]>("human");
  const [target, setTarget] = useState<EvaluatorRecord["target"]>("full trace");
  const [dimensions, setDimensions] = useState<EvaluatorDimension[]>(initialNewEvaluatorDimensions);
  const [instructions, setInstructions] = useState("");
  const [judgePromptName, setJudgePromptName] = useState("");
  const [assertionPath, setAssertionPath] = useState("");
  const [assertionConstraint, setAssertionConstraint] = useState("exists");
  const [runModes, setRunModes] = useState(defaultEvaluatorRunModes);
  const [createError, setCreateError] = useState("");
  const prefix = (routeBase ?? "").replace(/\/$/, "");
  const backHref = `${prefix}/ai-evaluators`;

  const {data: promptDetailRaw} = usePromptDetailQuery(judgePromptName, {
    skip: type !== "llm-judge" || !judgePromptName.trim(),
  });
  const promptDetail = useMemo(() => unwrapPromptDetail(promptDetailRaw), [promptDetailRaw]);
  const judgeOutputSchema = useMemo(() => {
    if (!promptDetail) {
      return undefined;
    }
    const production = promptDetail.labels.find((label) => label.label === "production");
    const versionNumber = production?.version ?? promptDetail.versions[0]?.version;
    const version = promptDetail.versions.find((entry) => entry.version === versionNumber);
    return version?.outputSchema;
  }, [promptDetail]);

  const schemaMismatchKey = useMemo(() => {
    if (type !== "llm-judge") {
      return undefined;
    }
    const missing = judgeSchemaMissingDimensions(dimensions, judgeOutputSchema);
    return missing[0];
  }, [dimensions, judgeOutputSchema, type]);

  const handleAddDimension = useCallback((): void => {
    setDimensions((current) => {
      return [...current, {dataType: "boolean", key: "", required: true}];
    });
  }, []);

  const handleDimensionChange = useCallback(
    (index: number, dimension: EvaluatorDimension): void => {
      setDimensions((current) => {
        return current.map((entry, entryIndex) => {
          if (entryIndex === index) {
            return dimension;
          }
          return entry;
        });
      });
    },
    []
  );

  const handleRemoveDimension = useCallback((index: number): void => {
    setDimensions((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((_entry, entryIndex) => entryIndex !== index);
    });
  }, []);

  const handleLiveSampleRateChange = useCallback((value: number): void => {
    setRunModes((current) => {
      return {...current, liveSampleRate: value};
    });
  }, []);

  const handleCreate = useCallback(async (): Promise<void> => {
    setCreateError("");
    if (!name.trim()) {
      setCreateError("Name is required.");
      return;
    }
    if (dimensions.some((dimension) => !dimension.key.trim())) {
      setCreateError("Each dimension needs a key.");
      return;
    }
    if (type === "llm-judge" && schemaMismatchKey) {
      setCreateError(
        `Judge prompt output schema missing required dimension "${schemaMismatchKey}"`
      );
      return;
    }
    try {
      const created = await createEvaluator({
        assertion:
          type === "json-assert"
            ? {constraint: assertionConstraint, path: assertionPath}
            : undefined,
        dimensions,
        instructions: type === "human" ? instructions : undefined,
        judgePromptName: type === "llm-judge" ? judgePromptName : undefined,
        name: name.trim(),
        runModes,
        target,
        type,
      }).unwrap();
      router.push(`${prefix}/ai-evaluator-detail?id=${encodeURIComponent(created.id)}`);
    } catch (error) {
      setCreateError(parseApiErrorTitle(error) ?? "Could not create evaluator.");
    }
  }, [
    assertionConstraint,
    assertionPath,
    createEvaluator,
    dimensions,
    instructions,
    judgePromptName,
    name,
    prefix,
    runModes,
    schemaMismatchKey,
    target,
    type,
  ]);

  return (
    <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-evaluator-new">
      <AiEvaluatorNewView
        assertionConstraint={assertionConstraint}
        assertionPath={assertionPath}
        createError={createError}
        dimensions={dimensions}
        instructions={instructions}
        isCreating={createState.isLoading}
        judgePromptName={judgePromptName}
        name={name}
        onAddDimension={handleAddDimension}
        onAssertionConstraintChange={setAssertionConstraint}
        onAssertionPathChange={setAssertionPath}
        onCreate={handleCreate}
        onDimensionChange={handleDimensionChange}
        onInstructionsChange={setInstructions}
        onJudgePromptNameChange={setJudgePromptName}
        onLiveSampleRateChange={handleLiveSampleRateChange}
        onNameChange={setName}
        onRemoveDimension={handleRemoveDimension}
        onTargetChange={setTarget}
        onTypeChange={setType}
        runModes={runModes}
        schemaMismatchKey={schemaMismatchKey}
        target={target}
        type={type}
      />
    </AiObservabilityChrome>
  );
};
