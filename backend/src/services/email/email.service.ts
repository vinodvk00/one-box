import { IEmailRepository } from '../../repositories/interfaces/email.interface';
import { EmailDocument, SearchFilters } from '../../types/email.types';
import { EmailSyncQueue } from '../../queues/email-sync.queue';
import { JobPriority } from '../../queues/queue.config';

/**
 * Email Service with Hybrid PostgreSQL + Elasticsearch Architecture
 *
 * - PostgreSQL: Source of truth (always written first)
 * - Elasticsearch: Search engine (synced via queue)
 * - Queue: Async sync with retry logic
 * - Fallback: PostgreSQL search if Elasticsearch fails
 */
export class EmailService {
    constructor(
        private postgresRepo: IEmailRepository,
        private elasticsearchRepo: IEmailRepository,
        private syncQueue?: EmailSyncQueue
    ) {}

    /**
     * Check if email exists (PostgreSQL)
     */
    async emailExists(emailId: string): Promise<boolean> {
        return await this.postgresRepo.exists(emailId);
    }

    /**
     * Index a single email with queue sync
     */
    async indexEmail(email: EmailDocument, priority: JobPriority = JobPriority.NORMAL): Promise<void> {
        await this.postgresRepo.index(email);

        if (this.syncQueue) {
            try {
                await this.syncQueue.queueEmailSync(email.id, priority);
            } catch (error: any) {
                console.error('❌ Failed to queue email sync:', error.message);
            }
        } else {
            console.warn('⚠️ Queue not available, syncing directly to Elasticsearch');
            try {
                await this.elasticsearchRepo.index(email);
            } catch (error: any) {
                console.error('❌ Failed to sync to Elasticsearch:', error.message);
            }
        }
    }

    /**
     * Bulk index emails with queue sync
     */
    async bulkIndexEmails(emails: EmailDocument[]): Promise<{ indexed: number; skipped: number }> {
        const result = await this.postgresRepo.bulkIndex(emails);

        if (this.syncQueue?.isAvailable() && result.indexed > 0) {
            try {
                const indexedEmailIds = emails
                    .filter((_, index) => index < result.indexed)
                    .map(email => email.id);

                await this.syncQueue.queueBulkSync(indexedEmailIds);
            } catch (error: any) {
                console.error('❌ Failed to queue bulk sync:', error.message);
                await this.directBulkSyncToElasticsearch(emails);
            }
        } else {
            console.warn('⚠️ Queue not available, syncing directly to Elasticsearch');
            await this.directBulkSyncToElasticsearch(emails);
        }

        return result;
    }

    /**
     * Direct bulk sync to Elasticsearch (fallback when queue is unavailable)
     */
    private async directBulkSyncToElasticsearch(emails: EmailDocument[]): Promise<void> {
        try {
            await this.elasticsearchRepo.bulkIndex(emails);
            console.log(`✅ Direct synced ${emails.length} emails to Elasticsearch`);
        } catch (error: any) {
            console.error(`❌ Failed to direct bulk sync:`, error.message);
        }
    }

    /**
     * Get email by ID (from PostgreSQL)
     */
    async getEmailById(emailId: string, userAccountIds?: string[]): Promise<EmailDocument> {
        return await this.postgresRepo.getById(emailId, userAccountIds);
    }

    /**
     * Get multiple emails by IDs (from PostgreSQL)
     */
    async getEmailsByIds(emailIds: string[]): Promise<EmailDocument[]> {
        return await this.postgresRepo.getByIds(emailIds);
    }

    /**
     * Update email category with direct Elasticsearch sync
     * Uses direct updateCategory instead of re-indexing entire document for better performance
     */
    async updateEmailCategory(emailId: string, category: string): Promise<void> {
        await this.postgresRepo.updateCategory(emailId, category);

        try {
            await this.elasticsearchRepo.updateCategory(emailId, category);
            console.log(`✅ Updated category for email ${emailId}: ${category}`);
        } catch (error: any) {
            console.error('❌ Failed to update category in Elasticsearch:', error.message);
            console.warn('⚠️  PostgreSQL is updated, but Elasticsearch sync failed. Use /sync/elasticsearch to fix.');
        }
    }

    /**
     * Bulk update email categories with direct Elasticsearch sync
     * Uses direct bulkUpdateCategories instead of re-indexing entire documents for better performance
     */
    async bulkUpdateEmailCategories(updates: Array<{ id: string; category: string }>): Promise<void> {
        await this.postgresRepo.bulkUpdateCategories(updates);

        try {
            await this.elasticsearchRepo.bulkUpdateCategories(updates);
            console.log(`✅ Updated ${updates.length} email categories in Elasticsearch`);
        } catch (error: any) {
            console.error('❌ Failed to bulk update categories in Elasticsearch:', error.message);
            console.warn('⚠️  PostgreSQL is updated, but Elasticsearch sync failed. Use /sync/elasticsearch to fix.');
        }
    }

    /**
     * Search emails with Elasticsearch priority and PostgreSQL fallback
     */
    async searchEmails(
        query: string,
        filters?: SearchFilters,
        pagination?: { page: number; limit: number }
    ): Promise<{
        emails: EmailDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        source?: 'elasticsearch' | 'postgresql';
    }> {
        try {
            const result = await this.elasticsearchRepo.search(query, filters, pagination);
            return { ...result, source: 'elasticsearch' };
        } catch (error: any) {
            console.warn('⚠️ Elasticsearch search failed, falling back to PostgreSQL:', error.message);

            try {
                const result = await this.postgresRepo.search(query, filters, pagination);
                return { ...result, source: 'postgresql' };
            } catch (pgError: any) {
                console.error('❌ PostgreSQL search also failed:', pgError.message);
                throw new Error('Search failed in both Elasticsearch and PostgreSQL');
            }
        }
    }

    /**
     * Get uncategorized email IDs (from PostgreSQL)
     */
    async getUncategorizedEmailIds(): Promise<string[]> {
        return await this.postgresRepo.getUncategorizedIds();
    }

    /**
     * Get uncategorized emails (from PostgreSQL)
     */
    async getUncategorizedEmails(userAccountIds?: string[]): Promise<EmailDocument[]> {
        return await this.postgresRepo.getUncategorized(userAccountIds);
    }

    /**
     * Get category statistics (from PostgreSQL)
     */
    async getCategoryStats(userAccountIds?: string[]): Promise<Array<{ category: string; count: number }>> {
        return await this.postgresRepo.getCategoryStats(userAccountIds);
    }

    /**
     * Get account statistics (from PostgreSQL)
     */
    async getAccountStats(userAccountIds?: string[]): Promise<Array<{ account: string; count: number }>> {
        return await this.postgresRepo.getAccountStats(userAccountIds);
    }

    /**
     * Get email count by account (from PostgreSQL)
     * @param account - Account ID or email address
     * @param userAccountIds - Optional user account IDs for access control (defense-in-depth)
     */
    async getEmailCountByAccount(account: string, userAccountIds?: string[]): Promise<number> {
        return await this.postgresRepo.getCountByAccount(account, userAccountIds);
    }

    /**
     * Delete emails by account (from both PostgreSQL and Elasticsearch)
     * @param account - Account ID or email address
     * @param userAccountIds - Optional user account IDs for access control (defense-in-depth)
     */
    async deleteEmailsByAccount(account: string, userAccountIds?: string[]): Promise<number> {
        const count = await this.postgresRepo.deleteByAccount(account, userAccountIds);

        try {
            await this.elasticsearchRepo.deleteByAccount(account, userAccountIds);
        } catch (error: any) {
            console.error('❌ Failed to delete from Elasticsearch:', error.message);
        }

        return count;
    }

    /**
     * Manually sync emails from PostgreSQL to Elasticsearch
     * Bypasses queue - useful when Redis is down or to fix inconsistencies
     */
    async bulkSyncToElasticsearch(emails: EmailDocument[]): Promise<{ indexed: number; skipped: number }> {
        try {
            return await this.elasticsearchRepo.bulkIndex(emails, true);
        } catch (error: any) {
            console.error('❌ Failed to bulk sync to Elasticsearch:', error.message);
            throw error;
        }
    }

    /**
     * Categorize email by ID (uses AI categorization)
     */
    async categorizeEmailById(emailId: string, userAccountIds?: string[]): Promise<{ category: string } | null> {
        const { categorizeEmail } = await import('../ai/ai-categorization.service');

        const emailResult = await this.getEmailById(emailId, userAccountIds);
        const email = emailResult as EmailDocument;

        if (!email) {
            throw new Error('Email not found');
        }

        const result = await categorizeEmail({
            subject: email.subject,
            body: email.body,
            from: email.from
        });

        if (!result) {
            return null;
        }

        await this.updateEmailCategory(emailId, result.category);

        return result;
    }
}
