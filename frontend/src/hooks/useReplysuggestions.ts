import { useState, useCallback } from "react";
import api from "@/services/api";
import type { ReplySuggestion, TrainingData, ApiError } from "@/types/email";

export interface UseReplySuggestionsResult {
  suggestion: ReplySuggestion | null;
  loading: boolean;
  error: string | null;
  getReplySuggestion: (emailId: string) => Promise<void>;
  addTrainingData: (data: TrainingData) => Promise<boolean>;
  clearSuggestion: () => void;
}

export const useReplySuggestions = (): UseReplySuggestionsResult => {
  const [suggestion, setSuggestion] = useState<ReplySuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReplySuggestion = useCallback(async (emailId: string) => {
    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const result = await api.replies.getReplySuggestion(emailId);

      if ("suggestion" in result && result.suggestion === null) {
        setError(
          result.message ||
            "No relevant training data found for this email type"
        );
      } else {
        setSuggestion(result as ReplySuggestion);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || "Failed to get reply suggestion");
    } finally {
      setLoading(false);
    }
  }, []);

  const addTrainingData = useCallback(
    async (data: TrainingData): Promise<boolean> => {
      try {
        setError(null);
        await api.training.addTrainingData(data);
        return true;
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.error || "Failed to add training data");
        return false;
      }
    },
    []
  );

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setError(null);
  }, []);

  return {
    suggestion,
    loading,
    error,
    getReplySuggestion,
    addTrainingData,
    clearSuggestion,
  };
};
