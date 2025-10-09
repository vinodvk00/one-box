import { create } from "zustand";
import { devtools } from "zustand/middleware";
import api from "@/services/api";
import type { EmailDocument, SearchParams, CategoryStats, ApiError, EmailListResponse } from "@/types/email";

interface EmailState {
  // Data state
  emails: EmailDocument[];
  selectedEmail: EmailDocument | null;
  totalCount: number;
  categoryStats: CategoryStats[];

  // Pagination state
  currentPage: number;
  pageSize: number;
  totalPages: number;

  // UI state
  loading: boolean;
  error: string | null;
  searchParams: SearchParams;

  // Refresh timestamp for triggering updates
  lastRefresh: number;

  // Actions
  setEmails: (emails: EmailDocument[]) => void;
  setSelectedEmail: (email: EmailDocument | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchParams: (params: SearchParams) => void;
  setCategoryStats: (stats: CategoryStats[]) => void;
  updateEmail: (id: string, updates: Partial<EmailDocument>) => void;
  clearEmails: () => void;
  reset: () => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Async actions
  fetchEmails: (params?: SearchParams) => Promise<void>;
  refreshEmails: () => Promise<void>;
  categorizeEmail: (id: string) => Promise<boolean>;
  fetchCategoryStats: () => Promise<void>;
  getEmailById: (id: string) => Promise<EmailDocument | null>;
  triggerRefresh: () => void;
}

const initialState = {
  emails: [],
  selectedEmail: null,
  totalCount: 0,
  categoryStats: [],
  currentPage: 1,
  pageSize: 50,
  totalPages: 1,
  loading: false,
  error: null,
  searchParams: {},
  lastRefresh: 0,
};

export const useEmailStore = create<EmailState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setEmails: (emails: EmailDocument[]) =>
        set(
          {
            emails,
            totalCount: emails.length,
            error: null,
          },
          false,
          "setEmails"
        ),

      setSelectedEmail: (email: EmailDocument | null) =>
        set({ selectedEmail: email }, false, "setSelectedEmail"),

      setLoading: (loading: boolean) => set({ loading }, false, "setLoading"),

      setError: (error: string | null) => set({ error }, false, "setError"),

      setSearchParams: (params: SearchParams) =>
        set({ searchParams: params }, false, "setSearchParams"),

      setCategoryStats: (stats: CategoryStats[]) =>
        set({ categoryStats: stats }, false, "setCategoryStats"),

      updateEmail: (id: string, updates: Partial<EmailDocument>) =>
        set(
          (state) => ({
            emails: state.emails.map((email) =>
              email.id === id ? { ...email, ...updates } : email
            ),
            selectedEmail:
              state.selectedEmail?.id === id
                ? { ...state.selectedEmail, ...updates }
                : state.selectedEmail,
            lastRefresh: Date.now(),
          }),
          false,
          "updateEmail"
        ),

      clearEmails: () =>
        set(
          {
            emails: [],
            selectedEmail: null,
            totalCount: 0,
            currentPage: 1,
            totalPages: 1,
            error: null,
          },
          false,
          "clearEmails"
        ),

      reset: () => set(initialState, false, "reset"),

      setCurrentPage: (page: number) =>
        set({ currentPage: page }, false, "setCurrentPage"),

      setPageSize: (size: number) =>
        set({ pageSize: size }, false, "setPageSize"),

      triggerRefresh: () =>
        set({ lastRefresh: Date.now() }, false, "triggerRefresh"),

      fetchEmails: async (params?: SearchParams) => {
        const state = get();
        const searchParams = {
          ...state.searchParams,
          page: state.currentPage,
          limit: state.pageSize,
          ...params,
        };

        set({ loading: true, error: null, searchParams }, false, "fetchEmails:start");

        try {
          const result: EmailListResponse = searchParams.q
            ? await api.emails.searchEmails(searchParams)
            : await api.emails.getEmails(searchParams);

          set(
            {
              emails: result.emails,
              totalCount: result.total,
              currentPage: result.page,
              totalPages: result.totalPages,
              loading: false,
              lastRefresh: Date.now(),
            },
            false,
            "fetchEmails:success"
          );
        } catch (err) {
          const apiError = err as ApiError;
          set(
            {
              emails: [],
              totalCount: 0,
              currentPage: 1,
              totalPages: 1,
              loading: false,
              error: apiError.error || "Failed to fetch emails",
            },
            false,
            "fetchEmails:error"
          );
        }
      },

      refreshEmails: async () => {
        const state = get();
        await get().fetchEmails(state.searchParams);
      },

      categorizeEmail: async (id: string): Promise<boolean> => {
        set({ error: null }, false, "categorizeEmail:start");

        try {
          const result = await api.emails.categorizeEmail(id);
          get().updateEmail(id, { category: result.category });
          await get().fetchCategoryStats();

          return true;
        } catch (err) {
          const apiError = err as ApiError;
          set(
            { error: apiError.error || "Failed to categorize email" },
            false,
            "categorizeEmail:error"
          );
          return false;
        }
      },

      fetchCategoryStats: async () => {
        try {
          const stats = await api.emails.getCategoryStats();
          set({ categoryStats: stats }, false, "fetchCategoryStats");
        } catch (err) {
          // Silently fail on category stats fetch
        }
      },

      getEmailById: async (id: string): Promise<EmailDocument | null> => {
        try {
          return await api.emails.getEmailById(id);
        } catch (err) {
          return null;
        }
      },
    }),
    {
      name: "email-store",
    }
  )
);
