/**
 * Email Type Definitions
 *
 * Centralized type definitions for email-related entities
 * Used across repositories, services, and controllers
 */

/**
 * Email Document Structure
 */
export interface EmailDocument {
    id: string;
    account: string;
    folder: string;
    subject: string;
    from: {
        name: string;
        address: string;
    };
    to: Array<{
        name: string;
        address: string;
    }>;
    date: Date;
    body: string;
    textBody?: string;
    htmlBody?: string;
    flags: string[];
    category?: string;
    uid: string;
}

/**
 * Email Search Filters
 */
export interface SearchFilters {
    account?: string;
    folder?: string;
    category?: string;
}

/**
 * Email Content (for AI categorization)
 */
export interface EmailContent {
    subject: string;
    body: string;
    from: {
        name: string;
        address: string;
    };
}
