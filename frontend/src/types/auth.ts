export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  authMethod: "password" | "oauth";
  createdAt: string;
  lastLoginAt: string;
  connectedAccounts?: Array<{
    id: string;
    email: string;
    authType: "imap" | "oauth";
    isActive: boolean;
  }>;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
}

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}
