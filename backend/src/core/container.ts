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

import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { OAuthService } from '../services/oauth.service';
import { EmailService } from '../services/email.service';

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
