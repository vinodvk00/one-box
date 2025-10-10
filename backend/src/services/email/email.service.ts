import { IEmailRepository } from '../../repositories/interfaces/email.interface';
import { EmailDocument, SearchFilters } from '../../types/email.types';

/**
 * Email Service 
 */
export class EmailService {
    constructor(private emailRepo: IEmailRepository) {}

    /**
     * Check if email exists
     */
    async emailExists(emailId: string): Promise<boolean> {
        return await this.emailRepo.exists(emailId);
    }

    /**
     * Index a single email
     */
    async indexEmail(email: EmailDocument): Promise<void> {
        await this.emailRepo.index(email);
    }

    /**
     * Bulk index emails
     */
    async bulkIndexEmails(emails: EmailDocument[]): Promise<{ indexed: number; skipped: number }> {
        return await this.emailRepo.bulkIndex(emails);
    }

    /**
     * Get email by ID
     */
    async getEmailById(emailId: string): Promise<EmailDocument> {
        return await this.emailRepo.getById(emailId);
    }

    /**
     * Get multiple emails by IDs
     */
    async getEmailsByIds(emailIds: string[]): Promise<EmailDocument[]> {
        return await this.emailRepo.getByIds(emailIds);
    }

    /**
     * Update email category
     */
    async updateEmailCategory(emailId: string, category: string): Promise<void> {
        await this.emailRepo.updateCategory(emailId, category);
    }

    /**
     * Bulk update email categories
     */
    async bulkUpdateEmailCategories(updates: Array<{ id: string; category: string }>): Promise<void> {
        await this.emailRepo.bulkUpdateCategories(updates);
    }

    /**
     * Search emails
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
    }> {
        return await this.emailRepo.search(query, filters, pagination);
    }

    /**
     * Get uncategorized email IDs
     */
    async getUncategorizedEmailIds(): Promise<string[]> {
        return await this.emailRepo.getUncategorizedIds();
    }

    /**
     * Get uncategorized emails
     */
    async getUncategorizedEmails(): Promise<EmailDocument[]> {
        return await this.emailRepo.getUncategorized();
    }

    /**
     * Get category statistics
     */
    async getCategoryStats(): Promise<Array<{ category: string; count: number }>> {
        return await this.emailRepo.getCategoryStats();
    }

    /**
     * Get account statistics
     */
    async getAccountStats(): Promise<Array<{ account: string; count: number }>> {
        return await this.emailRepo.getAccountStats();
    }

    /**
     * Get email count by account
     */
    async getEmailCountByAccount(account: string): Promise<number> {
        return await this.emailRepo.getCountByAccount(account);
    }

    /**
     * Delete emails by account
     */
    async deleteEmailsByAccount(account: string): Promise<number> {
        return await this.emailRepo.deleteByAccount(account);
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
