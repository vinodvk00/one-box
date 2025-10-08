import { createIndex } from './elasticsearch.service';
import {
    createOAuthTokensIndex,
    createAccountConfigsIndex
} from './oauth-storage.service';
import { createUsersIndex } from './user.service';

/*
 * Initialize all required Elasticsearch indices
 */
export const initializeDatabase = async (): Promise<void> => {
    console.log('🔧 Initializing database indices...');

    try {
        console.time('  📧 Create emails index');
        await createIndex();
        console.timeEnd('  📧 Create emails index');

        console.time('  👤 Create users index');
        await createUsersIndex();
        console.timeEnd('  👤 Create users index');

        console.time('  🔑 Create OAuth tokens index');
        await createOAuthTokensIndex();
        console.timeEnd('  🔑 Create OAuth tokens index');

        console.time('  ⚙️  Create account configs index');
        await createAccountConfigsIndex();
        console.timeEnd('  ⚙️  Create account configs index');

        console.log('✅ Database initialization completed successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
};

/*
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