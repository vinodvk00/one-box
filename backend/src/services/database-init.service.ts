import { createIndex } from './elasticsearch.service';
import {
    createOAuthTokensIndex,
    createAccountConfigsIndex
} from './oauth-storage.service';

/**
 * Initialize all required Elasticsearch indices
 */
export const initializeDatabase = async (): Promise<void> => {
    console.log('🔧 Initializing database indices...');

    try {
        // Initialize existing email index
        await createIndex();

        // Initialize OAuth-related indices
        await createOAuthTokensIndex();
        await createAccountConfigsIndex();

        console.log('✅ Database initialization completed successfully');
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
        const { client } = await import('./elasticsearch.service');

        const indices = ['emails', 'oauth_tokens', 'account_configs'];
        const checks = await Promise.all(
            indices.map((index: string) =>
                client.indices.exists({ index }).then((response: any) => ({
                    index,
                    exists: response.body
                }))
            )
        );

        const missingIndices = checks.filter((check: any) => !check.exists);

        if (missingIndices.length > 0) {
            console.warn('⚠️  Missing indices:', missingIndices.map((i: any) => i.index));
            return false;
        }

        console.log('✅ All required indices exist');
        return true;
    } catch (error) {
        console.error('❌ Database validation failed:', error);
        return false;
    }
};