import {Box, Button, Spinner, Text} from "@terreno/ui";
import {useLocalSearchParams} from "expo-router";
import React, {useCallback, useMemo, useState} from "react";
import type {AdminScreenWidgetProps} from "../../../types";
import {AiObservabilityChrome} from "../shell/AiObservabilityChrome";
import {AiPromptEditorView} from "./AiPromptEditorView";
import {
  latestVersionFromDetail,
  type PlaygroundRunResult,
  unwrapPromptDetail,
  unwrapPromptPayload,
} from "./promptTypes";
import {useAiObservabilityPromptsApi} from "./useAiObservabilityPromptsApi";

export const AiPromptEditorScreenWidget: React.FC<AdminScreenWidgetProps> = (props) => {
  const {api, routeBase} = props;
  const params = useLocalSearchParams<{name?: string | string[]}>();
  const nameParam = params.name;
  const name = Array.isArray(nameParam) ? nameParam[0] : nameParam;
  const {useCreateVersionMutation, useDetailQuery, usePlaygroundMutation, useSetLabelMutation} =
    useAiObservabilityPromptsApi(api);
  const {data, isError, isLoading, refetch} = useDetailQuery(name ?? "", {skip: !name});
  const [createVersion, createState] = useCreateVersionMutation();
  const [setLabel, labelState] = useSetLabelMutation();
  const [runPlayground, playgroundState] = usePlaygroundMutation();
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);

  const detail = useMemo(() => unwrapPromptDetail(data), [data]);
  const version = selectedVersion ?? (detail ? latestVersionFromDetail(detail) : 1);
  const prefix = (routeBase ?? "").replace(/\/$/, "");
  const backHref = `${prefix}/ai-prompts`;

  const handleSaveVersion = useCallback(
    async (body: {
      config?: Record<string, unknown>;
      system?: string;
      template: string;
      type: "chat" | "text";
      variables?: Array<{key: string; required: boolean}>;
    }): Promise<void> => {
      if (!name) {
        return;
      }
      const updated = await createVersion({body, name}).unwrap();
      setSelectedVersion(updated.version);
    },
    [createVersion, name]
  );

  const handleSetProduction = useCallback(
    async (nextVersion: number): Promise<void> => {
      if (!name) {
        return;
      }
      await setLabel({label: "production", name, version: nextVersion}).unwrap();
    },
    [name, setLabel]
  );

  const handleRunPlayground = useCallback(
    async (variables: Record<string, string>): Promise<void> => {
      if (!name) {
        return;
      }
      await runPlayground({name, variables, version}).unwrap();
    },
    [name, runPlayground, version]
  );

  const playgroundResult = unwrapPromptPayload<PlaygroundRunResult>(playgroundState.data);

  if (!name) {
    return (
      <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-prompt-editor">
        <Box padding={4}>
          <Text>Missing prompt name. Open a prompt from the list.</Text>
        </Box>
      </AiObservabilityChrome>
    );
  }

  if (isLoading) {
    return (
      <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-prompt-editor">
        <Box alignItems="center" padding={4} testID="ai-prompt-editor-loading">
          <Spinner />
        </Box>
      </AiObservabilityChrome>
    );
  }

  if (isError || !detail) {
    return (
      <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-prompt-editor">
        <Box gap={2} padding={4}>
          <Text color="error">{`Could not load ${name}.`}</Text>
          <Button onClick={() => refetch()} text="Retry" />
        </Box>
      </AiObservabilityChrome>
    );
  }

  return (
    <AiObservabilityChrome {...props} backHref={backHref} screenName="ai-prompt-editor">
      <AiPromptEditorView
        detail={detail}
        isRunningPlayground={playgroundState.isLoading}
        isSaving={createState.isLoading}
        isSettingProduction={labelState.isLoading}
        onRunPlayground={handleRunPlayground}
        onSaveVersion={handleSaveVersion}
        onSelectVersion={setSelectedVersion}
        onSetProduction={handleSetProduction}
        playgroundError={
          playgroundState.isError
            ? "Playground run failed. The backend needs an AI service wired to ObservabilityApp."
            : undefined
        }
        playgroundResult={playgroundResult}
        productionError={labelState.isError ? "Could not set production." : undefined}
        saveError={createState.isError ? "Could not save a new version." : undefined}
        selectedVersion={version}
      />
    </AiObservabilityChrome>
  );
};
