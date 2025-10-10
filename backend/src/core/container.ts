import { Client } from '@elastic/elasticsearch';

// PostgreSQL Pool (primary database)
import { dbPool } from '../database/pool';

// Elasticsearch Client (search engine only)
const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});


import { PostgresUserRepository } from '../repositories/postgres/user.repo';
import { PostgresOAuthRepository } from '../repositories/postgres/oauth.repo';
import { PostgresAccountRepository } from '../repositories/postgres/account.repo';
import { PostgresEmailRepository } from '../repositories/postgres/email.repo';

// Elasticsearch Repositories (LEGACY - for search only)
import { ElasticsearchUserRepository } from '../repositories/elasticsearch/user.repo';
import { ElasticsearchOAuthRepository } from '../repositories/elasticsearch/oauth.repo';
import { ElasticsearchAccountRepository } from '../repositories/elasticsearch/account.repo';
import { ElasticsearchEmailRepository } from '../repositories/elasticsearch/email.repo';

// Repository Interfaces (for type checking)
import { IUserRepository } from '../repositories/interfaces/user.interface';
import { IOAuthRepository } from '../repositories/interfaces/oauth.interface';
import { IAccountRepository } from '../repositories/interfaces/account.interface';
import { IEmailRepository } from '../repositories/interfaces/email.interface';

/**
 * These are the source of truth for all data
 */

const pgPool = dbPool.getPool();

export const userRepository: IUserRepository = new PostgresUserRepository(pgPool);
export const oauthRepository: IOAuthRepository = new PostgresOAuthRepository(pgPool);
export const accountRepository: IAccountRepository = new PostgresAccountRepository(pgPool);
export const emailRepository: IEmailRepository = new PostgresEmailRepository(pgPool);

/**
 * SEARCH REPOSITORIES (Elasticsearch)
 * Used ONLY for full-text search
 * Data synced from PostgreSQL
 */

export const emailSearchRepository = new ElasticsearchEmailRepository(esClient);

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


import { dbInitializer } from '../database/init';

/**
 * Initialize All Databases (PostgreSQL + Elasticsearch)
 */
export async function initializeRepositories(): Promise<void> {
    try {
        console.log('📦 Initializing databases...');

        console.log('\n🐘 PostgreSQL (Source of Truth):');
        await dbInitializer.initialize();

        console.log('\n🔍 Elasticsearch (Search Engine):');
        await emailSearchRepository.createIndex();
        console.log('✅ Email search index initialized');

        console.log('\n🎉 All databases initialized successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize databases:', error);
        throw error;
    }
}

/**
 * Export Elasticsearch Client (for legacy code)
 * This allows old code to still work during migration
 * TODO: Remove this export after full migration to DI
 */
export { esClient };

/**
 * Export Type Definitions
 * Centralized type exports for legacy services
 */
export { EmailDocument, SearchFilters, EmailContent } from '../types/email.types';

/**
 * Legacy Helper Functions (for backward compatibility)
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
