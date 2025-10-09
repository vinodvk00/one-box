import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import api from "@/services/api";
import type { User, ApiError } from "@/types/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;

  loading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  register: (email: string, password: string, name: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setUser: (user: User | null) =>
          set(
            {
              user,
              isAuthenticated: !!user,
              error: null
            },
            false,
            "setUser"
          ),

        setLoading: (loading: boolean) =>
          set({ loading }, false, "setLoading"),

        setError: (error: string | null) =>
          set({ error }, false, "setError"),

        clearError: () =>
          set({ error: null }, false, "clearError"),

        register: async (email: string, password: string, name: string): Promise<boolean> => {
          set({ loading: true, error: null }, false, "register:start");

          try {
            const result = await api.userAuth.register({ email, password, name });

            if (result.success) {
              await get().checkAuth();
              return true;
            }

            set({ loading: false, error: "Registration failed" }, false, "register:failed");
            return false;
          } catch (err) {
            const apiError = err as ApiError;
            set(
              {
                loading: false,
                error: apiError.message || apiError.error || "Registration failed",
              },
              false,
              "register:error"
            );
            return false;
          }
        },

        login: async (email: string, password: string): Promise<boolean> => {
          set({ loading: true, error: null }, false, "login:start");

          try {
            const result = await api.userAuth.login({ email, password });

            if (result.success && result.user) {
              set(
                {
                  user: result.user,
                  isAuthenticated: true,
                  loading: false,
                  error: null,
                },
                false,
                "login:success"
              );
              return true;
            }

            set({ loading: false, error: "Login failed" }, false, "login:failed");
            return false;
          } catch (err) {
            const apiError = err as ApiError;
            set(
              {
                loading: false,
                error: apiError.message || apiError.error || "Invalid credentials",
              },
              false,
              "login:error"
            );
            return false;
          }
        },

        loginWithGoogle: async () => {
          try {
            await api.userAuth.loginWithGoogle();
          } catch (err) {
            const apiError = err as ApiError;
            set(
              {
                error: apiError.message || apiError.error || "Failed to initiate Google login",
              },
              false,
              "loginWithGoogle:error"
            );
          }
        },

        logout: async () => {
          set({ loading: true, error: null }, false, "logout:start");

          try {
            await api.userAuth.logout();
            set(
              {
                ...initialState,
              },
              false,
              "logout:success"
            );
          } catch (err) {
            set(
              {
                ...initialState,
              },
              false,
              "logout:error"
            );
          }
        },

        checkAuth: async () => {
          set({ loading: true, error: null }, false, "checkAuth:start");

          try {
            const user = await api.userAuth.getCurrentUser();
            set(
              {
                user,
                isAuthenticated: true,
                loading: false,
                error: null,
              },
              false,
              "checkAuth:success"
            );
          } catch (err) {
            const apiError = err as ApiError;
            if (apiError.statusCode === 401) {
              set(
                {
                  user: null,
                  isAuthenticated: false,
                  loading: false,
                  error: null,
                },
                false,
                "checkAuth:unauthenticated"
              );
            } else {
              set(
                {
                  user: null,
                  isAuthenticated: false,
                  loading: false,
                  error: apiError.error || "Failed to check authentication",
                },
                false,
                "checkAuth:error"
              );
            }
          }
        },

        changePassword: async (currentPassword: string, newPassword: string): Promise<boolean> => {
          set({ loading: true, error: null }, false, "changePassword:start");

          try {
            const result = await api.userAuth.changePassword({ currentPassword, newPassword });

            if (result.success) {
              set({ loading: false, error: null }, false, "changePassword:success");
              return true;
            }

            set({ loading: false, error: "Failed to change password" }, false, "changePassword:failed");
            return false;
          } catch (err) {
            const apiError = err as ApiError;
            set(
              {
                loading: false,
                error: apiError.message || apiError.error || "Failed to change password",
              },
              false,
              "changePassword:error"
            );
            return false;
          }
        },

        refreshUser: async () => {
          try {
            const user = await api.userAuth.getCurrentUser();
            set({ user }, false, "refreshUser");
          } catch (err) {
          }
        },
      }),
      {
        name: "auth-store",
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: "auth-store",
    }
  )
);
