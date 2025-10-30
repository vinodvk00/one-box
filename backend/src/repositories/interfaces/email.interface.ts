import { EmailDocument, SearchFilters } from '../../types/email.types';

/**
 * Email Repository Interface
 *
 * Manages email data (metadata and content)
 */
export interface IEmailRepository {
    /**
     * Check if email exists by ID
     */
    exists(emailId: string): Promise<boolean>;

    /**
     * Index a single email
     */
    index(email: EmailDocument): Promise<void>;

    /**
     * Bulk index emails
     * @param emails - Array of email documents to index
     * @param forceUpdate - If true, updates existing documents; if false, only indexes new documents
     */
    bulkIndex(emails: EmailDocument[], forceUpdate?: boolean): Promise<{ indexed: number; skipped: number }>;

    /**
     * Get email by ID
     */
    getById(emailId: string, userAccountIds?: string[]): Promise<EmailDocument>;

    /**
     * Get multiple emails by IDs
     */
    getByIds(emailIds: string[]): Promise<EmailDocument[]>;

    /**
     * Update email category
     */
    updateCategory(emailId: string, category: string): Promise<void>;

    /**
     * Bulk update email categories
     */
    bulkUpdateCategories(updates: Array<{ id: string; category: string }>): Promise<void>;

    /**
     * Search emails
     */
    search(
        query: string,
        filters?: SearchFilters,
        pagination?: { page: number; limit: number }
    ): Promise<{
        emails: EmailDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;

    /**
     * Get uncategorized email IDs
     */
    getUncategorizedIds(): Promise<string[]>;

    /**
     * Get uncategorized emails (full documents)
     */
    getUncategorized(userAccountIds?: string[]): Promise<EmailDocument[]>;

    /**
     * Get category statistics
     */
    getCategoryStats(userAccountIds?: string[]): Promise<Array<{ category: string; count: number }>>;

    /**
     * Get account statistics
     */
    getAccountStats(userAccountIds?: string[]): Promise<Array<{ account: string; count: number }>>;

    /**
     * Get email count by account
     * @param account - Account ID or email address
     * @param userAccountIds - Optional user account IDs for access control (defense-in-depth)
     */
    getCountByAccount(account: string, userAccountIds?: string[]): Promise<number>;

    /**
     * Delete emails by account
     * @param account - Account ID or email address
     * @param userAccountIds - Optional user account IDs for access control (defense-in-depth)
     */
    deleteByAccount(account: string, userAccountIds?: string[]): Promise<number>;

    /**
     * Create the emails index/table
     */
    createIndex(): Promise<void>;
}
