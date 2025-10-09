import { EmailDocument, SearchFilters } from '../../services/elasticsearch.service';

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
     */
    bulkIndex(emails: EmailDocument[]): Promise<{ indexed: number; skipped: number }>;

    /**
     * Get email by ID
     */
    getById(emailId: string): Promise<EmailDocument>;

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
    getUncategorized(): Promise<EmailDocument[]>;

    /**
     * Get category statistics
     */
    getCategoryStats(): Promise<Array<{ category: string; count: number }>>;

    /**
     * Get account statistics
     */
    getAccountStats(): Promise<Array<{ account: string; count: number }>>;

    /**
     * Get email count by account
     */
    getCountByAccount(account: string): Promise<number>;

    /**
     * Delete emails by account
     */
    deleteByAccount(account: string): Promise<number>;

    /**
     * Create the emails index/table
     */
    createIndex(): Promise<void>;
}
