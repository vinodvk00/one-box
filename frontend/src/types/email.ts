export type EmailCategory =
  | "Interested"
  | "Meeting Booked"
  | "Not Interested"
  | "Spam"
  | "Out of Office";

export interface EmailContact {
  name: string;
  address: string;
}

export interface EmailDocument {
  id: string;
  account: string;
  folder: string;
  subject: string;
  from: EmailContact;
  to: EmailContact[];
  date: Date;
  body: string;
  textBody?: string;
  htmlBody?: string;
  flags: string[];
  category?: EmailCategory;
  uid: string;
}

export interface SearchFilters {
  account?: string;
  folder?: string;
  category?: string;
}

export interface SearchParams extends SearchFilters {
  q?: string;
}

export interface EmailCategorizationResult {
  category: EmailCategory;
  confidence: number;
  reasoning?: string;
}

export interface ReplySuggestion {
  suggestion: string;
  confidence: number;
  relevantContext: string[];
}

export interface TrainingData {
  scenario: string;
  context: string;
  response_template: string;
}

export interface CategoryStats {
  category: string;
  count: number;
}

export interface BatchCategorizationStatus {
  isRunning: boolean;
  uncategorizedCount: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

export type EmailListResponse = EmailDocument[];

export type EmailResponse = EmailDocument;
