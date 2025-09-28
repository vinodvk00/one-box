import { useCallback, useState } from "react";
import { getErrorMessage } from "@/utils/errorHandler";

export interface UseAsyncErrorResult {
  error: string | null;
  setError: (error: string | null) => void;
  handleAsyncError: (error: unknown) => void;
  clearError: () => void;
}

export function useAsyncError(): UseAsyncErrorResult {
  const [error, setError] = useState<string | null>(null);

  const handleAsyncError = useCallback((error: unknown) => {
    const message = getErrorMessage(error);
    setError(message);
    console.error("Async error:", error);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    setError,
    handleAsyncError,
    clearError,
  };
}
