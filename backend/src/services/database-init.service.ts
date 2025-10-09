import { createIndex } from './elasticsearch.service';
import {
    createOAuthTokensIndex,
    createAccountConfigsIndex
} from './oauth-storage.service';
import { createUsersIndex } from './user.service';

/**
 * Initialize all required Elasticsearch indices
 */
export const initializeDatabase = async (): Promise<void> => {
    try {
        await createIndex();
        await createUsersIndex();
        await createOAuthTokensIndex();
        await createAccountConfigsIndex();
    } catch (error) {
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