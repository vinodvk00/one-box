import { useState, useEffect, useCallback } from "react";
import api from "@/services/api";
import type {
  CategoryStats,
  BatchCategorizationStatus,
  ApiError,
} from "@/types/email";

export interface UseCategoriesResult {
  stats: CategoryStats[];
  batchStatus: BatchCategorizationStatus | null;
  loading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
  startBatchCategorization: () => Promise<void>;
  categorizeEmail: (id: string) => Promise<boolean>;
}

export const useCategories = (): UseCategoriesResult => {
  const [stats, setStats] = useState<CategoryStats[]>([]);
  const [batchStatus, setBatchStatus] =
    useState<BatchCategorizationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsResult, statusResult] = await Promise.all([
        api.emails.getCategoryStats(),
        api.emails.getBatchCategorizationStatus(),
      ]);

      setStats(statsResult);
      setBatchStatus(statusResult);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || "Failed to fetch category data");
    } finally {
      setLoading(false);
    }
  }, []);

  const startBatchCategorization = useCallback(async () => {
    try {
      setError(null);
      await api.emails.startBatchCategorization();
      const statusResult = await api.emails.getBatchCategorizationStatus();
      setBatchStatus(statusResult);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || "Failed to start batch categorization");
    }
  }, []);

  const categorizeEmail = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null);
        await api.emails.categorizeEmail(id);
        await refreshStats();
        return true;
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.error || "Failed to categorize email");
        return false;
      }
    },
    [refreshStats]
  );

  useEffect(() => {
    const loadInitialStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const [statsResult, statusResult] = await Promise.all([
          api.emails.getCategoryStats(),
          api.emails.getBatchCategorizationStatus(),
        ]);

        setStats(statsResult);
        setBatchStatus(statusResult);
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.error || "Failed to fetch category data");
      } finally {
        setLoading(false);
      }
    };

    loadInitialStats();
  }, []);

  useEffect(() => {
    if (batchStatus?.isRunning) {
      const interval = setInterval(refreshStats, 5000);
      return () => clearInterval(interval);
    }
  }, [batchStatus?.isRunning, refreshStats]);

  return {
    stats,
    batchStatus,
    loading,
    error,
    refreshStats,
    startBatchCategorization,
    categorizeEmail,
  };
};
