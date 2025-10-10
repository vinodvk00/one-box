/**
 * Dependency Injection Container
 */

import { Client } from '@elastic/elasticsearch';

// Repository Implementations
import { ElasticsearchUserRepository } from '../repositories/elasticsearch/user.repo';
import { ElasticsearchOAuthRepository } from '../repositories/elasticsearch/oauth.repo';
import { ElasticsearchAccountRepository } from '../repositories/elasticsearch/account.repo';
import { ElasticsearchEmailRepository } from '../repositories/elasticsearch/email.repo';

// Repository Interfaces (for type checking)
import { IUserRepository } from '../repositories/interfaces/user.interface';
import { IOAuthRepository } from '../repositories/interfaces/oauth.interface';
import { IAccountRepository } from '../repositories/interfaces/account.interface';
import { IEmailRepository } from '../repositories/interfaces/email.interface';


// Elasticsearch Client (singleton)
const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

/**
 * Repositories handle data access (CRUD operations)
 */

export const userRepository: IUserRepository = new ElasticsearchUserRepository(esClient);
export const oauthRepository: IOAuthRepository = new ElasticsearchOAuthRepository(esClient);
export const accountRepository: IAccountRepository = new ElasticsearchAccountRepository(esClient);
export const emailRepository: IEmailRepository = new ElasticsearchEmailRepository(esClient);

/**
 * Services contain business logic and use repositories for data access
 */

import { UserService } from '../services/auth/user.service';
import { AuthService } from '../services/auth/auth.service';
import { OAuthService } from '../services/auth/oauth.service';
import { EmailService } from '../services/email/email.service';

// Create service instances (inject repositories)
export const userService = new UserService(userRepository);
export const authService = new AuthService(userRepository);
export const oauthService = new OAuthService(oauthRepository, accountRepository);
export const emailService = new EmailService(emailRepository);

/**
 * Initialize All Indices (Database Setup)
 */
export async function initializeRepositories(): Promise<void> {
    try {
        console.log('📦 Initializing repositories...');

        await userRepository.createIndex();
        console.log('✅ User repository initialized');

        await oauthRepository.createIndex();
        console.log('✅ OAuth repository initialized');

        await accountRepository.createIndex();
        console.log('✅ Account repository initialized');

        await emailRepository.createIndex();
        console.log('✅ Email repository initialized');

        console.log('🎉 All repositories initialized successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize repositories:', error);
        throw error;
    }
}

/**
 * ============================================
 * Export Elasticsearch Client (for legacy code)
 * ============================================
 * This allows old code to still work during migration
 * TODO: Remove this export after full migration to DI
 */
export { esClient };

/**
 * ============================================
 * Export Type Definitions
 * ============================================
 * Centralized type exports for legacy services
 */
export { EmailDocument, SearchFilters, EmailContent } from '../types/email.types';

/**
 * ============================================
 * Legacy Helper Functions (for backward compatibility)
 * ============================================
 * These functions wrap emailService methods for legacy code
 * TODO: Refactor legacy services to use emailService directly
 */

/**
 * Create email index (legacy wrapper)
 */
export const createIndex = async (): Promise<void> => {
    return await emailRepository.createIndex();
};

/**
 * Check if email exists (legacy wrapper)
 */
export const emailExists = async (emailId: string): Promise<boolean> => {
    return await emailService.emailExists(emailId);
};

/**
 * Index a single email (legacy wrapper)
 */
export const indexEmail = async (email: any): Promise<void> => {
    return await emailService.indexEmail(email);
};

/**
 * Bulk index emails (legacy wrapper)
 */
export const bulkIndexEmails = async (emails: any[]): Promise<{ indexed: number; skipped: number }> => {
    return await emailService.bulkIndexEmails(emails);
};

/**
 * Get uncategorized email IDs (legacy wrapper)
 */
export const getUncategorizedEmailIds = async (): Promise<string[]> => {
    return await emailService.getUncategorizedEmailIds();
};

/**
 * Get emails by IDs (legacy wrapper)
 */
export const getEmailsByIds = async (emailIds: string[]): Promise<any[]> => {
    return await emailService.getEmailsByIds(emailIds);
};

/**
 * Update email category (legacy wrapper)
 */
export const updateEmailCategory = async (emailId: string, category: string): Promise<void> => {
    return await emailService.updateEmailCategory(emailId, category);
};

/**
 * Bulk update email categories (legacy wrapper)
 */
export const bulkUpdateEmailCategories = async (updates: Array<{ id: string; category: string }>): Promise<void> => {
    return await emailService.bulkUpdateEmailCategories(updates);
};

/**
 * Get category statistics (legacy wrapper)
 */
export const getCategoryStats = async (): Promise<Array<{ category: string; count: number }>> => {
    return await emailService.getCategoryStats();
};
