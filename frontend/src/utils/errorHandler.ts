import type { ApiError } from "@/types/email";
import { ERROR_MESSAGES } from "./constants";

export class AppError extends Error {
  public statusCode?: number;
  public originalError?: unknown;

  constructor(message: string, statusCode?: number, originalError?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (error as ApiError).error === "string"
  );
}

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Network Error") ||
      error.message.includes("fetch") ||
      error.message.includes("ERR_NETWORK"))
  );
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message || error.error;
  }

  if (isNetworkError(error)) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred";
}

export function getErrorMessageByStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "Bad request. Please check your input and try again.";
    case 401:
      return "Unauthorized. Please log in and try again.";
    case 403:
      return "Forbidden. You do not have permission to perform this action.";
    case 404:
      return ERROR_MESSAGES.EMAIL_NOT_FOUND;
    case 408:
      return "Request timeout. Please try again.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
      return ERROR_MESSAGES.SERVER_ERROR;
    case 502:
      return "Bad gateway. The server is temporarily unavailable.";
    case 503:
      return "Service unavailable. Please try again later.";
    case 504:
      return "Gateway timeout. The server took too long to respond.";
    default:
      return ERROR_MESSAGES.SERVER_ERROR;
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (
        isApiError(error) &&
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        throw error;
      }

      if (attempt === maxAttempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw new AppError(
    `Failed after ${maxAttempts} attempts: ${getErrorMessage(lastError)}`,
    undefined,
    lastError
  );
}

export function handleAsyncError(error: unknown): void {
  const message = getErrorMessage(error);
}

export class ValidationError extends Error {
  public field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export function validateEmailId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new ValidationError(ERROR_MESSAGES.INVALID_EMAIL_ID);
  }

  if (!id.includes("_") || !id.includes("@")) {
    throw new ValidationError(ERROR_MESSAGES.INVALID_EMAIL_ID);
  }
}

export function validateSearchQuery(query: string): void {
  if (query && query.length < 2) {
    throw new ValidationError(
      "Search query must be at least 2 characters long"
    );
  }
}

export function safeAsync<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleAsyncError(error);
      return null;
    }
  };
}
