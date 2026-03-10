import {useCallback, useState} from "react";
import type {ScoreSubmission, ScoringFunction} from "../../backend/types";
import {useLangfuseContext} from "../LangfuseProvider";

interface UseEvaluationResult {
  submit: (score: ScoreSubmission) => Promise<void>;
  loadConfig: () => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  scoringFunctions: ScoringFunction[];
}

interface EvaluationConfigResponse {
  scoringFunctions: ScoringFunction[];
}

export const useEvaluation = (): UseEvaluationResult => {
  const {apiBaseUrl} = useLangfuseContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoringFunctions, setScoringFunctions] = useState<ScoringFunction[]>([]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/evaluations/config`, {credentials: "include"});
      if (res.ok) {
        const data = (await res.json()) as EvaluationConfigResponse;
        setScoringFunctions(data.scoringFunctions);
      }
    } catch {
      // config is optional, ignore errors
    }
  }, [apiBaseUrl]);

  const submit = useCallback(
    async (score: ScoreSubmission): Promise<void> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const res = await fetch(`${apiBaseUrl}/evaluations`, {
          body: JSON.stringify(score),
          credentials: "include",
          headers: {"Content-Type": "application/json"},
          method: "POST",
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {title?: string};
          throw new Error(body.title ?? `Failed to submit evaluation: ${res.status}`);
        }
      } catch (err) {
        setError((err as Error).message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiBaseUrl]
  );

  return {error, isSubmitting, loadConfig, scoringFunctions, submit};
};
