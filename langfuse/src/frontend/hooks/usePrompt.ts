import {useCallback, useEffect, useState} from "react";
import type {ChatMessage, LangfuseCachedPrompt} from "../../backend/types";
import {useLangfuseContext} from "../LangfuseProvider";

interface UsePromptResult {
  prompt: LangfuseCachedPrompt | null;
  compiled: string | ChatMessage[] | null;
  isLoading: boolean;
  error: string | null;
  compile: (variables: Record<string, string>) => string | ChatMessage[] | null;
  refetch: () => void;
}

export const usePrompt = (name: string, label?: string): UsePromptResult => {
  const {apiBaseUrl} = useLangfuseContext();
  const [prompt, setPrompt] = useState<LangfuseCachedPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchKey is a manual refresh trigger
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const url = `${apiBaseUrl}/prompts/${encodeURIComponent(name)}${label ? `?label=${encodeURIComponent(label)}` : ""}`;

    fetch(url, {credentials: "include"})
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch prompt: ${res.status}`);
        }
        return res.json() as Promise<LangfuseCachedPrompt>;
      })
      .then((data) => {
        if (!cancelled) {
          setPrompt(data);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, name, label, fetchKey]);

  const compile = useCallback(
    (variables: Record<string, string>): string | ChatMessage[] | null => {
      if (!prompt) {
        return null;
      }

      const replace = (template: string): string =>
        template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? `{{${key}}}`);

      if (prompt.type === "text") {
        return replace(prompt.prompt as string);
      }

      return (prompt.prompt as ChatMessage[]).map((msg) => ({
        content: replace(msg.content),
        role: msg.role,
      }));
    },
    [prompt]
  );

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  return {
    compile,
    compiled: prompt ? compile({}) : null,
    error,
    isLoading,
    prompt,
    refetch,
  };
};
