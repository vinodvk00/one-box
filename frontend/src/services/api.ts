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
} from "@/types/email";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
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

    console.error("API Error:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: apiError.error,
    });

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

export const healthApi = {
  checkHealth: async (): Promise<{ status: string; message: string }> => {
    const response = await apiClient.get<{ status: string; message: string }>(
      "/"
    );
    return handleResponse(response);
  },
};

const api = {
  emails: emailApi,
  replies: replyApi,
  training: trainingApi,
  health: healthApi,
};

export default api;
