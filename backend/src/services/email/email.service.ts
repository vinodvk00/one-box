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

        if (this.syncQueue && result.indexed > 0) {
            try {
                const indexedEmailIds = emails
                    .filter((_, index) => index < result.indexed)
                    .map(email => email.id);

                await this.syncQueue.queueBulkSync(indexedEmailIds);
            } catch (error: any) {
                console.error('❌ Failed to queue bulk sync:', error.message);
            }
        } else if (!this.syncQueue) {
            console.warn('⚠️ Queue not available, syncing directly to Elasticsearch');
            try {
                await this.elasticsearchRepo.bulkIndex(emails);
            } catch (error: any) {
                console.error('❌ Failed to bulk sync to Elasticsearch:', error.message);
            }
        }

        return result;
    }

    /**
     * Get email by ID (from PostgreSQL)
     */
    async getEmailById(emailId: string): Promise<EmailDocument> {
        return await this.postgresRepo.getById(emailId);
    }

    /**
     * Get multiple emails by IDs (from PostgreSQL)
     */
    async getEmailsByIds(emailIds: string[]): Promise<EmailDocument[]> {
        return await this.postgresRepo.getByIds(emailIds);
    }

    /**
     * Update email category with queue sync
     */
    async updateEmailCategory(emailId: string, category: string): Promise<void> {
        await this.postgresRepo.updateCategory(emailId, category);

        if (this.syncQueue) {
            try {
                await this.syncQueue.queueEmailSync(emailId, JobPriority.HIGH);
            } catch (error: any) {
                console.error('❌ Failed to queue category update sync:', error.message);
            }
        } else {
            try {
                await this.elasticsearchRepo.updateCategory(emailId, category);
            } catch (error: any) {
                console.error('❌ Failed to sync category update to Elasticsearch:', error.message);
            }
        }
    }

    /**
     * Bulk update email categories with queue sync
     */
    async bulkUpdateEmailCategories(updates: Array<{ id: string; category: string }>): Promise<void> {
        await this.postgresRepo.bulkUpdateCategories(updates);

        if (this.syncQueue) {
            try {
                const emailIds = updates.map(u => u.id);
                await this.syncQueue.queueBulkSync(emailIds);
            } catch (error: any) {
                console.error('❌ Failed to queue bulk category update sync:', error.message);
            }
        } else {
            try {
                await this.elasticsearchRepo.bulkUpdateCategories(updates);
            } catch (error: any) {
                console.error('❌ Failed to sync bulk category updates to Elasticsearch:', error.message);
            }
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
    async getUncategorizedEmails(): Promise<EmailDocument[]> {
        return await this.postgresRepo.getUncategorized();
    }

    /**
     * Get category statistics (from PostgreSQL)
     */
    async getCategoryStats(): Promise<Array<{ category: string; count: number }>> {
        return await this.postgresRepo.getCategoryStats();
    }

    /**
     * Get account statistics (from PostgreSQL)
     */
    async getAccountStats(): Promise<Array<{ account: string; count: number }>> {
        return await this.postgresRepo.getAccountStats();
    }

    /**
     * Get email count by account (from PostgreSQL)
     */
    async getEmailCountByAccount(account: string): Promise<number> {
        return await this.postgresRepo.getCountByAccount(account);
    }

    /**
     * Delete emails by account (from both PostgreSQL and Elasticsearch)
     */
    async deleteEmailsByAccount(account: string): Promise<number> {
        const count = await this.postgresRepo.deleteByAccount(account);

        try {
            await this.elasticsearchRepo.deleteByAccount(account);
        } catch (error: any) {
            console.error('❌ Failed to delete from Elasticsearch:', error.message);
        }

        return count;
    }

    /**
     * Categorize email by ID (uses AI categorization)
     */
    async categorizeEmailById(emailId: string): Promise<{ category: string } | null> {
        const { categorizeEmail } = await import('../ai/ai-categorization.service');

        const emailResult = await this.getEmailById(emailId);
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
