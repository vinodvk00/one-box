import type { EmailCategory } from "@/types/email";

export const EMAIL_CATEGORIES: EmailCategory[] = [
  "Interested",
  "Meeting Booked",
  "Not Interested",
  "Spam",
  "Out of Office",
];

export const CATEGORY_INFO: Record<
  EmailCategory,
  { label: string; description: string }
> = {
  Interested: {
    label: "Interested",
    description: "Leads showing genuine interest in products/services",
  },
  "Meeting Booked": {
    label: "Meeting Booked",
    description: "Calendar invites and meeting confirmations",
  },
  "Not Interested": {
    label: "Not Interested",
    description: "Rejections, declines, or unsubscribes",
  },
  Spam: {
    label: "Spam",
    description: "Promotional content and irrelevant emails",
  },
  "Out of Office": {
    label: "Out of Office",
    description: "Auto-reply messages indicating unavailability",
  },
};

export const EMAIL_FOLDERS = [
  "INBOX",
  "Sent",
  "Drafts",
  "Trash",
  "Spam",
  "Important",
] as const;

export const API_CONFIG = {
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

export const UI_CONFIG = {
  EMAILS_PER_PAGE: 50,
  SEARCH_DEBOUNCE_MS: 300,
  AUTO_REFRESH_INTERVAL: 60000,
  NOTIFICATION_DURATION: 5000,
} as const;

export const STORAGE_KEYS = {
  SEARCH_FILTERS: "email_search_filters",
  USER_PREFERENCES: "user_preferences",
  LAST_VISITED_EMAIL: "last_visited_email",
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
  SERVER_ERROR: "Server error. Please try again later.",
  EMAIL_NOT_FOUND: "Email not found.",
  CATEGORIZATION_FAILED: "Failed to categorize email. Please try again.",
  SEARCH_FAILED: "Search failed. Please try again.",
  INVALID_EMAIL_ID: "Invalid email ID provided.",
} as const;

export const SUCCESS_MESSAGES = {
  EMAIL_CATEGORIZED: "Email categorized successfully",
  BATCH_STARTED: "Batch categorization started",
  TRAINING_DATA_ADDED: "Training data added successfully",
  REPLY_GENERATED: "Reply suggestion generated",
} as const;
