import { initializeRepositories } from '../core/container';

/**
 * Initialize all required Elasticsearch indices
 *
 * REFACTORED: Now uses the dependency injection container
 * This ensures all repositories are properly initialized
 */
export const initializeDatabase = async (): Promise<void> => {
    try {
        console.log('🔧 Initializing database...');
        await initializeRepositories();
        console.log('✅ Database initialization complete!');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
};

/**
 * Check if all required indices exist
 */
export const validateDatabaseSetup = async (): Promise<boolean> => {
    try {
        const { client: getClient } = await import('./elasticsearch.service');
        const client = getClient();

        const indices = ['emails', 'users', 'oauth_tokens', 'account_configs'];
        const checks = await Promise.all(
            indices.map(async (index: string) => {
                const exists = await client.indices.exists({ index });
                return {
                    index,
                    exists
                };
            })
        );

        const missingIndices = checks.filter((check: any) => !check.exists);

        if (missingIndices.length > 0) {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
};