import axios, { AxiosError } from "axios";
import type { AxiosResponse } from "axios";
import type {
  EmailListResponse,
  EmailResponse,
  SearchParams,
  EmailCategorizationResult,
  ReplySuggestion,
  TrainingData,
  CategoryStats,
  BatchCategorizationStatus,
  ApiError,
  ConnectedAccountsResponse,
  AccountConfig,
  AccountActionResponse,
} from "@/types/email";
import type {
  User,
  RegisterRequest,
  LoginRequest,
  ChangePasswordRequest,
  AuthResponse,
} from "@/types/auth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8000" : "");

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // timeout: 30000, // no timeout for now as some operations may take longer
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable session cookies
});

apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiError>) => {
    const apiError: ApiError = {
      error:
        error.response?.data?.error ||
        error.message ||
        "An unknown error occurred",
      message: error.response?.data?.message,
      statusCode: error.response?.status,
    };

    return Promise.reject(apiError);
  }
);

const handleResponse = <T>(response: AxiosResponse<T>): T => response.data;

export const emailApi = {
  getEmails: async (filters?: SearchParams): Promise<EmailListResponse> => {
    const params = new URLSearchParams();
    if (filters?.account) params.append("account", filters.account);
    if (filters?.folder) params.append("folder", filters.folder);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await apiClient.get<EmailListResponse>(`/api?${params}`);
    return handleResponse(response);
  },

  searchEmails: async (
    searchParams: SearchParams
  ): Promise<EmailListResponse> => {
    const params = new URLSearchParams();
    if (searchParams.q) params.append("q", searchParams.q);
    if (searchParams.account) params.append("account", searchParams.account);
    if (searchParams.folder) params.append("folder", searchParams.folder);
    if (searchParams.category) params.append("category", searchParams.category);
    if (searchParams.page) params.append("page", searchParams.page.toString());
    if (searchParams.limit) params.append("limit", searchParams.limit.toString());

    const response = await apiClient.get<EmailListResponse>(
      `/api/search?${params}`
    );
    return handleResponse(response);
  },

  getEmailById: async (id: string): Promise<EmailResponse> => {
    const response = await apiClient.get<EmailResponse>(
      `/api/${encodeURIComponent(id)}`
    );
    return handleResponse(response);
  },

  getUncategorizedEmails: async (): Promise<EmailListResponse> => {
    const response =
      await apiClient.get<EmailListResponse>("/api/uncategorized");
    return handleResponse(response);
  },

  categorizeEmail: async (id: string): Promise<EmailCategorizationResult> => {
    const response = await apiClient.post<EmailCategorizationResult>(
      `/api/${encodeURIComponent(id)}/categorize`
    );
    return handleResponse(response);
  },

  getCategoryStats: async (): Promise<CategoryStats[]> => {
    const response = await apiClient.get<CategoryStats[]>(
      "/api/stats/categories"
    );
    return handleResponse(response);
  },

  startBatchCategorization: async (): Promise<{
    status: string;
    message: string;
  }> => {
    const response = await apiClient.post<{ status: string; message: string }>(
      "/api/batch-categorize"
    );
    return handleResponse(response);
  },

  getBatchCategorizationStatus:
    async (): Promise<BatchCategorizationStatus> => {
      const response = await apiClient.get<BatchCategorizationStatus>(
        "/api/batch-categorize/status"
      );
      return handleResponse(response);
    },

  syncOAuthEmails: async (options?: {
    email?: string;
    daysBack?: number;
    forceReindex?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    syncedAccounts: string[];
    tokenInfo?: {
      hasFullAccess: boolean;
      scopes: string[];
      recommendation: string;
    };
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      syncedAccounts: string[];
      tokenInfo?: {
        hasFullAccess: boolean;
        scopes: string[];
        recommendation: string;
      };
    }>("/api/sync/oauth", options || {});
    return handleResponse(response);
  },

  manageEmailIndex: async (options: {
    action: 'delete' | 'count' | 'reindex';
    email: string;
    daysBack?: number;
  }): Promise<{
    success: boolean;
    message: string;
    count: number;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      count: number;
    }>("/api/index/manage", options);
    return handleResponse(response);
  },

  getIndexStats: async (): Promise<Array<{account: string; count: number}>> => {
    const response = await apiClient.get<Array<{account: string; count: number}>>(
      "/api/index/stats"
    );
    return handleResponse(response);
  },
};

export const replyApi = {
  getReplySuggestion: async (
    id: string
  ): Promise<ReplySuggestion | { suggestion: null; message: string }> => {
    const response = await apiClient.get<
      ReplySuggestion | { suggestion: null; message: string }
    >(`/api/emails/${encodeURIComponent(id)}/suggest-reply`);
    return handleResponse(response);
  },
};

export const trainingApi = {
  addTrainingData: async (
    trainingData: TrainingData
  ): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.post<{
      success: boolean;
      message?: string;
    }>("/api/training", trainingData);
    return handleResponse(response);
  },
};

export const authApi = {
  initiateGmailOAuth: (): void => {
    window.location.href = `${API_BASE_URL}/auth/gmail/connect`;
  },

  getConnectedAccounts: async (): Promise<ConnectedAccountsResponse> => {
    const response = await apiClient.get<ConnectedAccountsResponse>("/auth/accounts");
    return handleResponse(response);
  },

  getAccountDetails: async (email: string): Promise<AccountConfig> => {
    const response = await apiClient.get<AccountConfig>(
      `/auth/accounts/${encodeURIComponent(email)}`
    );
    return handleResponse(response);
  },

  disconnectAccount: async (accountId: string): Promise<AccountActionResponse> => {
    const response = await apiClient.delete<AccountActionResponse>(
      `/auth/accounts/${encodeURIComponent(accountId)}`
    );
    return handleResponse(response);
  },

  toggleAccountStatus: async (email: string): Promise<AccountActionResponse> => {
    const response = await apiClient.patch<AccountActionResponse>(
      `/auth/accounts/${encodeURIComponent(email)}/toggle`
    );
    return handleResponse(response);
  },

  forceReconnectAccount: async (email: string): Promise<{
    success: boolean;
    message: string;
    authUrl: string;
    redirectToAuth: boolean;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      authUrl: string;
      redirectToAuth: boolean;
    }>(`/auth/accounts/${encodeURIComponent(email)}/force-reconnect`);
    return handleResponse(response);
  },
};

export const healthApi = {
  checkHealth: async (): Promise<{ status: string; message: string }> => {
    const response = await apiClient.get<{ status: string; message: string }>(
      "/"
    );
    return handleResponse(response);
  },
};

export const userAuthApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/register", data);
    return handleResponse(response);
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/auth/login", data);
    return handleResponse(response);
  },

  logout: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      "/auth/logout"
    );
    return handleResponse(response);
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<{
      user: User;
      emailAccounts?: any[];
      totalAccounts?: number;
    }>("/auth/me");
    const data = handleResponse(response);
    return data.user || (data as any);
  },

  changePassword: async (
    data: ChangePasswordRequest
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      "/auth/change-password",
      data
    );
    return handleResponse(response);
  },

  loginWithGoogle: async (): Promise<void> => {
    const response = await apiClient.get<{ success: boolean; authUrl: string }>(
      "/auth/login/google"
    );
    const result = handleResponse(response);
    if (result.authUrl) {
      window.location.href = result.authUrl;
    }
  },
};

const api = {
  emails: emailApi,
  replies: replyApi,
  training: trainingApi,
  auth: authApi,
  userAuth: userAuthApi,
  health: healthApi,
};

export default api;
