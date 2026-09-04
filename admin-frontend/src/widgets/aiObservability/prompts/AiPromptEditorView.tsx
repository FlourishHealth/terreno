import {
  Badge,
  Box,
  Button,
  Heading,
  Modal,
  SegmentedControl,
  SelectField,
  Text,
  TextArea,
  TextField,
} from "@terreno/ui";
import React, {useCallback, useState} from "react";
import {AiPromptPlaygroundView} from "./AiPromptPlaygroundView";
import {
  nextVersionFromDetail,
  outgoingProductionCopy,
  type PlaygroundRunResult,
  type PromptDetail,
  type PromptVersionDetail,
  productionVersionFromDetail,
  schemaSummary,
  TEMPERATURE_PRESETS,
} from "./promptTypes";

export interface AiPromptEditorViewProps {
  detail: PromptDetail;
  isRunningPlayground: boolean;
  isSaving: boolean;
  isSettingProduction: boolean;
  onRunPlayground: (variables: Record<string, string>) => Promise<void>;
  onSaveVersion: (body: {
    config?: Record<string, unknown>;
    system?: string;
    template: string;
    type: "chat" | "text";
    variables?: Array<{key: string; required: boolean}>;
  }) => Promise<void>;
  onSelectVersion: (version: number) => void;
  onSetProduction: (version: number) => Promise<void>;
  playgroundError?: string;
  playgroundResult?: PlaygroundRunResult;
  productionError?: string;
  saveError?: string;
  selectedVersion: number;
}

const typeOptions = [
  {label: "Chat", value: "chat"},
  {label: "Text", value: "text"},
];

const parseVariables = (text: string): Array<{key: string; required: boolean}> => {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((key) => ({key, required: true}));
};

const AiPromptEditorForm: React.FC<{
  current: PromptVersionDetail;
  isSaving: boolean;
  isSettingProduction: boolean;
  nextVersion: number;
  onOpenProduction: () => void;
  onSaveVersion: AiPromptEditorViewProps["onSaveVersion"];
  productionError?: string;
  saveError?: string;
}> = ({
  current,
  isSaving,
  isSettingProduction,
  nextVersion,
  onOpenProduction,
  onSaveVersion,
  productionError,
  saveError,
}) => {
  const [type, setType] = useState<"chat" | "text">(current.type);
  const [system, setSystem] = useState(current.system ?? "");
  const [template, setTemplate] = useState(current.template ?? "");
  const [variablesText, setVariablesText] = useState(
    current.variables.map((entry) => entry.key).join(", ")
  );
  const [temperature, setTemperature] = useState(
    String((current.config?.temperature as number | undefined) ?? 0.3)
  );

  const handleSaveAsNext = useCallback(async (): Promise<void> => {
    await onSaveVersion({
      config: {temperature: Number(temperature)},
      system: type === "chat" ? system : undefined,
      template,
      type,
      variables: parseVariables(variablesText),
    });
  }, [onSaveVersion, system, temperature, template, type, variablesText]);

  return (
    <Box gap={3} testID="ai-prompt-editor-form">
      <SelectField
        onChange={(value) => {
          setType(value as "chat" | "text");
        }}
        options={typeOptions}
        requireValue
        testID="ai-prompt-type"
        title="Type"
        value={type}
      />
      {type === "chat" ? (
        <TextArea
          onChange={setSystem}
          rows={6}
          testID="ai-prompt-system"
          title="System"
          value={system}
        />
      ) : undefined}
      <TextArea
        onChange={setTemplate}
        rows={10}
        testID="ai-prompt-template"
        title="Template"
        value={template}
      />
      <TextField
        helperText="Comma-separated names. Schema summary of the selected version is read-only below."
        onChange={setVariablesText}
        testID="ai-prompt-variables"
        title="Variables"
        value={variablesText}
      />
      <Text color="secondaryDark" size="sm" testID="ai-prompt-schema-summary">
        {schemaSummary(current)}
      </Text>
      <SelectField
        onChange={setTemperature}
        options={TEMPERATURE_PRESETS}
        requireValue
        testID="ai-prompt-temperature"
        title="Temperature"
        value={temperature}
      />
      <Text color="secondaryDark" size="sm">
        Model hint: set in version config when the provider requires it. Temperature is the
        operator-facing preset. One production label per prompt.
      </Text>
      {saveError ? <Text color="error">{saveError}</Text> : undefined}
      {productionError ? <Text color="error">{productionError}</Text> : undefined}
      <Box direction="row" gap={2} wrap>
        <Button
          disabled={isSaving || !template.trim()}
          iconName="floppy-disk"
          onClick={handleSaveAsNext}
          testID="ai-prompt-save-next"
          text={`Save as v${nextVersion}`}
        />
        <Button
          disabled={isSettingProduction}
          onClick={onOpenProduction}
          testID="ai-prompt-set-production"
          text={`Set v${current.version} as production…`}
          variant="secondary"
        />
      </Box>
    </Box>
  );
};

export const AiPromptEditorView: React.FC<AiPromptEditorViewProps> = ({
  detail,
  isRunningPlayground,
  isSaving,
  isSettingProduction,
  onRunPlayground,
  onSaveVersion,
  onSelectVersion,
  onSetProduction,
  playgroundError,
  playgroundResult,
  productionError,
  saveError,
  selectedVersion,
}) => {
  const productionVersion = productionVersionFromDetail(detail);
  const nextVersion = nextVersionFromDetail(detail);
  const current = detail.versions.find((entry) => entry.version === selectedVersion);
  const [tabIndex, setTabIndex] = useState(0);
  const [confirmProduction, setConfirmProduction] = useState(false);

  const handleConfirmProduction = useCallback(async (): Promise<void> => {
    await onSetProduction(selectedVersion);
    setConfirmProduction(false);
  }, [onSetProduction, selectedVersion]);

  if (!current) {
    return (
      <Box padding={4}>
        <Text color="error">{`Version ${selectedVersion} was not found.`}</Text>
      </Box>
    );
  }

  const outgoingCopy = outgoingProductionCopy({detail, selectedVersion});

  return (
    <Box direction="row" flex="grow" gap={4} testID="ai-prompt-editor">
      <Box gap={2} testID="ai-prompt-version-rail" width={200}>
        <Heading size="sm">Versions</Heading>
        {detail.versions
          .slice()
          .sort((left, right) => right.version - left.version)
          .map((version) => {
            const isLatest = version.version === nextVersion - 1;
            const isProduction = version.version === productionVersion;
            return (
              <Box alignItems="center" direction="row" gap={2} key={version.version}>
                <Button
                  onClick={() => {
                    onSelectVersion(version.version);
                  }}
                  testID={`ai-prompt-version-${version.version}`}
                  text={`v${version.version}`}
                  variant={version.version === selectedVersion ? "primary" : "ghost"}
                />
                {isProduction ? (
                  <Badge
                    status="success"
                    testID={`ai-prompt-dot-prod-${version.version}`}
                    variant="status"
                  />
                ) : undefined}
                {isLatest ? (
                  <Badge
                    status="info"
                    testID={`ai-prompt-dot-latest-${version.version}`}
                    variant="status"
                  />
                ) : undefined}
              </Box>
            );
          })}
        <Box gap={1}>
          {productionVersion !== undefined ? (
            <Badge status="success" value={`production · v${productionVersion}`} />
          ) : (
            <Badge status="warning" value="no production" />
          )}
          <Badge status="info" value={`latest · v${nextVersion - 1}`} />
        </Box>
      </Box>
      <Box flex="grow" gap={3}>
        <Heading size="md">{detail.name}</Heading>
        <Text color="secondaryDark">
          {`${detail.folder} · immutable versions — save creates v${nextVersion}`}
        </Text>
        <Text color="secondaryDark" size="sm" testID="ai-prompt-outgoing-version">
          {outgoingCopy}
        </Text>
        <SegmentedControl
          items={["Editor", "Playground"]}
          onChange={setTabIndex}
          selectedIndex={tabIndex}
          testID="ai-prompt-editor-tabs"
        />
        {tabIndex === 1 ? (
          <AiPromptPlaygroundView
            detail={detail}
            isRunning={isRunningPlayground}
            onRun={onRunPlayground}
            result={playgroundResult}
            runError={playgroundError}
            selectedVersion={current}
          />
        ) : (
          <AiPromptEditorForm
            current={current}
            isSaving={isSaving}
            isSettingProduction={isSettingProduction}
            key={`${detail.name}-${current.version}-${detail.versions.length}`}
            nextVersion={nextVersion}
            onOpenProduction={() => {
              setConfirmProduction(true);
            }}
            onSaveVersion={onSaveVersion}
            productionError={productionError}
            saveError={saveError}
          />
        )}
      </Box>
      <Modal
        onDismiss={() => {
          setConfirmProduction(false);
        }}
        primaryButtonOnClick={handleConfirmProduction}
        primaryButtonText="Set production"
        secondaryButtonOnClick={() => {
          setConfirmProduction(false);
        }}
        secondaryButtonText="Cancel"
        testID="ai-prompt-production-modal"
        title="Set production version"
        visible={confirmProduction}
      >
        <Text testID="ai-prompt-production-modal-copy">{outgoingCopy}</Text>
      </Modal>
    </Box>
  );
};
