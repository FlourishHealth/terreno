import type {ScreenWidgetComponent} from "../../../types";
import {AiPromptEditorScreenWidget} from "../prompts/AiPromptEditorScreen";
import {AiPromptsScreenWidget} from "../prompts/AiPromptsListScreen";
import {AiReviewItemScreenWidget} from "../review/AiReviewItemScreen";
import {AiReviewScreenWidget} from "../review/AiReviewQueueScreen";
import {AiTraceDetailScreenWidget} from "../traces/AiTraceDetailScreen";
import {AiTracesScreenWidget} from "../traces/AiTracesListScreen";

export {
  AiPromptEditorScreenWidget,
  AiPromptsScreenWidget,
  AiReviewItemScreenWidget,
  AiReviewScreenWidget,
  AiTraceDetailScreenWidget,
  AiTracesScreenWidget,
};

export const AI_OBSERVABILITY_WIDGETS: Record<string, ScreenWidgetComponent> = {
  "ai-prompt-editor": AiPromptEditorScreenWidget,
  "ai-prompts": AiPromptsScreenWidget,
  "ai-review": AiReviewScreenWidget,
  "ai-review-item": AiReviewItemScreenWidget,
  "ai-trace-detail": AiTraceDetailScreenWidget,
  "ai-traces": AiTracesScreenWidget,
};
