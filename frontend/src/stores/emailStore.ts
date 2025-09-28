import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { EmailDocument, SearchParams, CategoryStats } from "@/types/email";

interface EmailState {
  emails: EmailDocument[];
  selectedEmail: EmailDocument | null;
  totalCount: number;

  loading: boolean;
  error: string | null;
  searchParams: SearchParams;

  categoryStats: CategoryStats[];

  setEmails: (emails: EmailDocument[]) => void;
  setSelectedEmail: (email: EmailDocument | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchParams: (params: SearchParams) => void;
  setCategoryStats: (stats: CategoryStats[]) => void;
  updateEmail: (id: string, updates: Partial<EmailDocument>) => void;
  clearEmails: () => void;
  reset: () => void;
}

const initialState = {
  emails: [],
  selectedEmail: null,
  totalCount: 0,
  loading: false,
  error: null,
  searchParams: {},
  categoryStats: [],
};

export const useEmailStore = create<EmailState>()(
  devtools(
    (set) => ({
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
            error: null,
          },
          false,
          "clearEmails"
        ),

      reset: () => set(initialState, false, "reset"),
    }),
    {
      name: "email-store",
    }
  )
);
