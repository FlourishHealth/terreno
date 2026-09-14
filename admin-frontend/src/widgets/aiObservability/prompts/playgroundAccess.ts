export type PlaygroundAiSource = "request-key" | "server" | "unavailable";

const PLAYGROUND_MISSING_API_KEY_ERROR_TITLE =
  "No AI service is available. Configure ObservabilityApp.aiService or provide an AI API key.";

const DEFAULT_PLAYGROUND_API_KEY_HINT = "Add an AI API key in your app settings, then try again.";

const PLAYGROUND_BACKEND_UNAVAILABLE_MESSAGE =
  "Playground is unavailable. Configure ObservabilityApp.aiService or requestAiServiceFactory on the backend.";

export interface ResolvePlaygroundBlockedMessageOptions {
  apiKey?: string;
  apiKeyHint?: string;
  apiKeyLoading?: boolean;
  playgroundAiSource?: PlaygroundAiSource;
}

export const resolvePlaygroundBlockedMessage = ({
  apiKey,
  apiKeyHint,
  apiKeyLoading,
  playgroundAiSource,
}: ResolvePlaygroundBlockedMessageOptions): string | undefined => {
  if (apiKeyLoading) {
    return undefined;
  }
  if (playgroundAiSource === "request-key" && !apiKey?.trim()) {
    return apiKeyHint ?? DEFAULT_PLAYGROUND_API_KEY_HINT;
  }
  if (playgroundAiSource === "unavailable") {
    return PLAYGROUND_BACKEND_UNAVAILABLE_MESSAGE;
  }
  return undefined;
};

export interface ResolvePlaygroundRunErrorOptions {
  apiKey?: string;
  apiKeyHint?: string;
  error: unknown;
  playgroundAiSource?: PlaygroundAiSource;
}

const apiErrorTitle = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return undefined;
  }
  return (error as {data?: {title?: string}}).data?.title;
};

export const resolvePlaygroundRunError = ({
  apiKey,
  apiKeyHint,
  error,
  playgroundAiSource,
}: ResolvePlaygroundRunErrorOptions): string => {
  const title = apiErrorTitle(error);
  if (
    playgroundAiSource === "request-key" &&
    !apiKey?.trim() &&
    title === PLAYGROUND_MISSING_API_KEY_ERROR_TITLE
  ) {
    return apiKeyHint ?? DEFAULT_PLAYGROUND_API_KEY_HINT;
  }
  if (title) {
    return title;
  }
  return "Playground run failed. Try again or check your AI configuration.";
};
