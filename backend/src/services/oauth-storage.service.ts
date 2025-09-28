import { client } from './elasticsearch.service';
import { OAuthTokenDocument, AccountConfigDocument } from '../types/auth.types';

const OAUTH_TOKENS_INDEX = 'oauth_tokens';
const ACCOUNT_CONFIGS_INDEX = 'account_configs';

export const createOAuthTokensIndex = async (): Promise<void> => {
    const indexExists = await client.indices.exists({ index: OAUTH_TOKENS_INDEX });

    if (!indexExists) {
        await client.indices.create({
            index: OAUTH_TOKENS_INDEX,
            body: {
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
            }
        });
        console.log(`✅ Created ${OAUTH_TOKENS_INDEX} index`);
    }
};

export const storeOAuthTokens = async (tokenDoc: OAuthTokenDocument): Promise<void> => {
    await client.index({
        index: OAUTH_TOKENS_INDEX,
        id: tokenDoc.id,
        body: tokenDoc
    });
};

export const getOAuthTokens = async (email: string): Promise<OAuthTokenDocument | null> => {
    try {
        const response = await client.search({
            index: OAUTH_TOKENS_INDEX,
            body: {
                query: {
                    term: { email: email }
                }
            }
        });

        const hits = response.hits.hits;
        if (hits.length === 0) return null;

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

    await client.update({
        index: OAUTH_TOKENS_INDEX,
        id: existingTokens.id,
        body: {
            doc: {
                ...updates,
                lastUsed: new Date()
            }
        }
    });
};

export const deleteOAuthTokens = async (email: string): Promise<void> => {
    await client.deleteByQuery({
        index: OAUTH_TOKENS_INDEX,
        body: {
            query: {
                term: { email: email }
            }
        }
    });
};

export const createAccountConfigsIndex = async (): Promise<void> => {
    const indexExists = await client.indices.exists({ index: ACCOUNT_CONFIGS_INDEX });

    if (!indexExists) {
        await client.indices.create({
            index: ACCOUNT_CONFIGS_INDEX,
            body: {
                mappings: {
                    properties: {
                        id: { type: 'keyword' },
                        email: { type: 'keyword' },
                        authType: { type: 'keyword' },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'date' },
                        lastSyncAt: { type: 'date' },
                        syncStatus: { type: 'keyword' }
                    }
                }
            }
        });
        console.log(`✅ Created ${ACCOUNT_CONFIGS_INDEX} index`);
    }
};

export const storeAccountConfig = async (configDoc: AccountConfigDocument): Promise<void> => {
    await client.index({
        index: ACCOUNT_CONFIGS_INDEX,
        id: configDoc.id,
        body: configDoc
    });
};

export const getAccountConfig = async (email: string): Promise<AccountConfigDocument | null> => {
    try {
        const response = await client.search({
            index: ACCOUNT_CONFIGS_INDEX,
            body: {
                query: {
                    term: { email: email }
                }
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
        const response = await client.search({
            index: ACCOUNT_CONFIGS_INDEX,
            body: {
                query: { match_all: {} },
                size: 100
            }
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

    await client.update({
        index: ACCOUNT_CONFIGS_INDEX,
        id: existingConfig.id,
        body: {
            doc: updates
        }
    });
};

export const deleteAccountConfig = async (email: string): Promise<void> => {
    await client.deleteByQuery({
        index: ACCOUNT_CONFIGS_INDEX,
        body: {
            query: {
                term: { email: email }
            }
        }
    });
};

export const getActiveAccountConfigs = async (): Promise<AccountConfigDocument[]> => {
    try {
        const response = await client.search({
            index: ACCOUNT_CONFIGS_INDEX,
            body: {
                query: {
                    term: { isActive: true }
                },
                size: 100
            }
        });

        return response.hits.hits.map((hit: any) => hit._source as AccountConfigDocument);
    } catch (error) {
        console.error('Error retrieving active account configs:', error);
        return [];
    }
};