import { useState, useEffect, useCallback } from "react";
import api from "@/services/api";
import type { EmailDocument, SearchParams, ApiError } from "@/types/email";

export interface UseEmailsResult {
  emails: EmailDocument[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  searchEmails: (params: SearchParams) => Promise<void>;
  refreshEmails: () => Promise<void>;
  getEmailById: (id: string) => Promise<EmailDocument | null>;
}

export const useEmails = (initialFilters?: SearchParams): UseEmailsResult => {
  const [emails, setEmails] = useState<EmailDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const searchEmails = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError(null);

    try {
      const result = params.q
        ? await api.emails.searchEmails(params)
        : await api.emails.getEmails(params);

      setEmails(result);
      setTotalCount(result.length);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || "Failed to fetch emails");
      setEmails([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEmails = useCallback(async () => {
    if (initialFilters) {
      await searchEmails(initialFilters);
    } else {
      await searchEmails({});
    }
  }, [initialFilters, searchEmails]);

  const getEmailById = useCallback(
    async (id: string): Promise<EmailDocument | null> => {
      try {
        return await api.emails.getEmailById(id);
      } catch (err) {
        const apiError = err as ApiError;
        console.error("Failed to fetch email:", apiError.error);
        return null;
      }
    },
    []
  );

  useEffect(() => {
    if (initialFilters) {
      searchEmails(initialFilters);
    } else {
      searchEmails({});
    }
  }, []);

  return {
    emails,
    loading,
    error,
    totalCount,
    searchEmails,
    refreshEmails,
    getEmailById,
  };
};
