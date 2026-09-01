import {Text} from "@terreno/ui";
import React from "react";
import type {AdminScreenWidgetProps, ScreenWidgetComponent} from "../../../types";
import {AiPromptEditorScreenWidget} from "../prompts/AiPromptEditorScreen";
import {AiPromptsScreenWidget} from "../prompts/AiPromptsListScreen";
import {AiTraceDetailScreenWidget} from "../traces/AiTraceDetailScreen";
import {AiTracesScreenWidget} from "../traces/AiTracesListScreen";
import {AiObservabilityChrome} from "./AiObservabilityChrome";

const PlaceholderBody: React.FC<{screenName: string}> = ({screenName}) => (
  <Text color="secondaryDark" testID={`ai-observability-placeholder-${screenName}`}>
    Operator screens for this section ship in a later task.
  </Text>
);

const createPlaceholderWidget = (screenName: string): ScreenWidgetComponent => {
  const Widget: React.FC<AdminScreenWidgetProps> = (props) => (
    <AiObservabilityChrome {...props} screenName={screenName}>
      <PlaceholderBody screenName={screenName} />
    </AiObservabilityChrome>
  );
  return Widget;
};

export {
  AiPromptEditorScreenWidget,
  AiPromptsScreenWidget,
  AiTraceDetailScreenWidget,
  AiTracesScreenWidget,
};

export const AiReviewScreenWidget = createPlaceholderWidget("ai-review");
export const AiReviewItemScreenWidget = createPlaceholderWidget("ai-review-item");

export const AI_OBSERVABILITY_WIDGETS: Record<string, ScreenWidgetComponent> = {
  "ai-prompt-editor": AiPromptEditorScreenWidget,
  "ai-prompts": AiPromptsScreenWidget,
  "ai-review": AiReviewScreenWidget,
  "ai-review-item": AiReviewItemScreenWidget,
  "ai-trace-detail": AiTraceDetailScreenWidget,
  "ai-traces": AiTracesScreenWidget,
};
