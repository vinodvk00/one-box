import { client as getClient } from './elasticsearch.service';
import { OAuthTokenDocument, AccountConfigDocument } from '../types/auth.types';

const OAUTH_TOKENS_INDEX = 'oauth_tokens';
const ACCOUNT_CONFIGS_INDEX = 'account_configs';

export const createOAuthTokensIndex = async (): Promise<void> => {
    console.time('    🔍 Check OAuth tokens index');
    const client = getClient();
    const indexExists = await client.indices.exists({ index: OAUTH_TOKENS_INDEX });
    console.timeEnd('    🔍 Check OAuth tokens index');

    if (!indexExists) {
        console.time('    ➕ Create OAuth tokens index');
        await client.indices.create({
            index: OAUTH_TOKENS_INDEX,
            mappings: {
                properties: {
                    id: { type: 'keyword' },
                    email: { type: 'keyword' },
                    accessToken: { type: 'text', index: false },
                    refreshToken: { type: 'text', index: false },
                    tokenExpiry: { type: 'date' },
                    scope: { type: 'keyword' },
                    createdAt: { type: 'date' },
                    lastUsed: { type: 'date' }
                }
            }
        });
        console.timeEnd('    ➕ Create OAuth tokens index');
        console.log(`✅ Created ${OAUTH_TOKENS_INDEX} index`);
    }
};

export const storeOAuthTokens = async (tokenDoc: OAuthTokenDocument): Promise<void> => {
    const client = getClient();
    await client.index({
        index: OAUTH_TOKENS_INDEX,
        id: tokenDoc.id,
        document: tokenDoc,
        refresh: 'wait_for'
    });
};

export const getOAuthTokens = async (email: string): Promise<OAuthTokenDocument | null> => {
    try {
        const client = getClient();
        const documentId = `oauth_${email}`;

        try {
            const directResult = await client.get({
                index: OAUTH_TOKENS_INDEX,
                id: documentId
            });

            if (directResult._source) {
                return directResult._source as OAuthTokenDocument;
            }
        } catch (directError: any) {
            console.log(`No direct document found for ID ${documentId}, falling back to search by email.`);
        }

        const response = await client.search({
            index: OAUTH_TOKENS_INDEX,
            query: {
                term: { email: email }
            }
        });

        const hits = response.hits.hits;
        if (hits.length === 0) {
            return null;
        }

        return hits[0]._source as OAuthTokenDocument;
    } catch (error) {
        console.error('Error retrieving OAuth tokens:', error);
        return null;
    }
};

export const updateOAuthTokens = async (email: string, updates: Partial<OAuthTokenDocument>): Promise<void> => {
    const existingTokens = await getOAuthTokens(email);
    if (!existingTokens) {
        throw new Error(`No OAuth tokens found for email: ${email}`);
    }

    const client = getClient();
    await client.update({
        index: OAUTH_TOKENS_INDEX,
        id: existingTokens.id,
        doc: {
            ...updates,
            lastUsed: new Date()
        }
    });
};

export const deleteOAuthTokens = async (email: string): Promise<void> => {
    const client = getClient();
    await client.deleteByQuery({
        index: OAUTH_TOKENS_INDEX,
        query: {
            term: { email: email }
        }
    });
};

export const createAccountConfigsIndex = async (): Promise<void> => {
    console.time('    🔍 Check account configs index');
    const client = getClient();
    const indexExists = await client.indices.exists({ index: ACCOUNT_CONFIGS_INDEX });
    console.timeEnd('    🔍 Check account configs index');

    if (!indexExists) {
        console.time('    ➕ Create account configs index');
        await client.indices.create({
            index: ACCOUNT_CONFIGS_INDEX,
            mappings: {
                properties: {
                    id: { type: 'keyword' },
                    userId: { type: 'keyword' },
                    email: { type: 'keyword' },
                    authType: { type: 'keyword' },
                    isPrimary: { type: 'boolean' },
                    isActive: { type: 'boolean' },
                    imapConfig: {
                        properties: {
                            host: { type: 'keyword' },
                            port: { type: 'integer' },
                            secure: { type: 'boolean' },
                            password: { type: 'text', index: false }
                        }
                    },
                    createdAt: { type: 'date' },
                    lastSyncAt: { type: 'date' },
                    syncStatus: { type: 'keyword' }
                }
            }
        });
        console.timeEnd('    ➕ Create account configs index');
        console.log(`✅ Created ${ACCOUNT_CONFIGS_INDEX} index`);
    }
};

export const storeAccountConfig = async (configDoc: AccountConfigDocument): Promise<void> => {
    const client = getClient();
    await client.index({
        index: ACCOUNT_CONFIGS_INDEX,
        id: configDoc.id,
        document: configDoc,
        refresh: 'wait_for'
    });
};

export const getAccountConfig = async (email: string): Promise<AccountConfigDocument | null> => {
    try {
        const client = getClient();
        const response = await client.search({
            index: ACCOUNT_CONFIGS_INDEX,
            query: {
                term: { email: email }
            }
        });

        const hits = response.hits.hits;
        if (hits.length === 0) return null;

        return hits[0]._source as AccountConfigDocument;
    } catch (error) {
        console.error('Error retrieving account config:', error);
        return null;
    }
};

export const getAllAccountConfigs = async (): Promise<AccountConfigDocument[]> => {
    try {
        const client = getClient();
        const response = await client.search({
            index: ACCOUNT_CONFIGS_INDEX,
            query: { match_all: {} },
            size: 100
        });

        return response.hits.hits.map((hit: any) => hit._source as AccountConfigDocument);
    } catch (error) {
        console.error('Error retrieving account configs:', error);
        return [];
    }
};

export const updateAccountConfig = async (email: string, updates: Partial<AccountConfigDocument>): Promise<void> => {
    const existingConfig = await getAccountConfig(email);
    if (!existingConfig) {
        throw new Error(`No account config found for email: ${email}`);
    }

    const client = getClient();
    await client.update({
        index: ACCOUNT_CONFIGS_INDEX,
        id: existingConfig.id,
        doc: updates
    });
};

export const deleteAccountConfig = async (email: string): Promise<void> => {
    const client = getClient();
    await client.deleteByQuery({
        index: ACCOUNT_CONFIGS_INDEX,
        query: {
            term: { email: email }
        }
    });
};

export const getActiveAccountConfigs = async (): Promise<AccountConfigDocument[]> => {
    try {
        const client = getClient();
        const response = await client.search({
            index: ACCOUNT_CONFIGS_INDEX,
            query: {
                term: { isActive: true }
            },
            size: 100
        });

        return response.hits.hits.map((hit: any) => hit._source as AccountConfigDocument);
    } catch (error) {
        console.error('Error retrieving active account configs:', error);
        return [];
    }
};

/**
 * Get account configs by user ID
 */
export const getAccountConfigsByUserId = async (userId: string): Promise<AccountConfigDocument[]> => {
    try {
        const client = getClient();
        const response = await client.search({
            index: ACCOUNT_CONFIGS_INDEX,
            query: {
                term: { userId: userId }
            },
            size: 100
        });

        return response.hits.hits.map((hit: any) => hit._source as AccountConfigDocument);
    } catch (error) {
        console.error('Error retrieving account configs by userId:', error);
        return [];
    }
};

/**
 * Get account config by ID
 */
export const getAccountConfigById = async (accountId: string): Promise<AccountConfigDocument | null> => {
    try {
        const client = getClient();
        const response = await client.get({
            index: ACCOUNT_CONFIGS_INDEX,
            id: accountId
        });

        if (!response._source) return null;

        return response._source as AccountConfigDocument;
    } catch (error: any) {
        if (error.meta?.statusCode === 404) {
            return null;
        }
        console.error('Error retrieving account config by ID:', error);
        return null;
    }
};

/**
 * Update account config by ID
 */
export const updateAccountConfigById = async (accountId: string, updates: Partial<AccountConfigDocument>): Promise<void> => {
    const client = getClient();
    await client.update({
        index: ACCOUNT_CONFIGS_INDEX,
        id: accountId,
        doc: updates,
        refresh: 'wait_for'
    });
};

/**
 * Update multiple account configs by userId
 */
export const updateAccountConfigsByUserId = async (userId: string, updates: Partial<AccountConfigDocument>): Promise<void> => {
    const client = getClient();
    await client.updateByQuery({
        index: ACCOUNT_CONFIGS_INDEX,
        query: {
            term: { userId: userId }
        },
        script: {
            source: Object.entries(updates)
                .map(([key, value]) => `ctx._source.${key} = params.${key}`)
                .join('; '),
            params: updates
        },
        refresh: true
    });
};

/**
 * Delete account config by ID
 */
export const deleteAccountConfigById = async (accountId: string): Promise<void> => {
    const client = getClient();
    await client.delete({
        index: ACCOUNT_CONFIGS_INDEX,
        id: accountId,
        refresh: 'wait_for'
    });
};