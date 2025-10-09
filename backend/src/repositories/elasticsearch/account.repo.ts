import { Client } from '@elastic/elasticsearch';
import { IAccountRepository } from '../interfaces/account.interface';
import { AccountConfigDocument } from '../../types/auth.types';

/**
 * Elasticsearch Account Repository
 *
 * Manages email account configurations (IMAP/OAuth settings)
 */
export class ElasticsearchAccountRepository implements IAccountRepository {
    private readonly INDEX = 'account_configs';

    constructor(private esClient: Client) {}

    /**
     * Create account configs index
     */
    async createIndex(): Promise<void> {
        const indexExists = await this.esClient.indices.exists({ index: this.INDEX });

        if (!indexExists) {
            await this.esClient.indices.create({
                index: this.INDEX,
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
        }
    }

    /**
     * Store account configuration
     */
    async store(configDoc: AccountConfigDocument): Promise<void> {
        await this.esClient.index({
            index: this.INDEX,
            id: configDoc.id,
            document: configDoc,
            refresh: 'wait_for'
        });
    }

    /**
     * Get account config by email
     */
    async getByEmail(email: string): Promise<AccountConfigDocument | null> {
        try {
            const response = await this.esClient.search({
                index: this.INDEX,
                query: {
                    term: { email: email }
                }
            });

            const hits = response.hits.hits;
            if (hits.length === 0) return null;

            return hits[0]._source as AccountConfigDocument;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get account config by ID
     */
    async getById(accountId: string): Promise<AccountConfigDocument | null> {
        try {
            const response = await this.esClient.get({
                index: this.INDEX,
                id: accountId
            });

            if (!response._source) return null;

            return response._source as AccountConfigDocument;
        } catch (error: any) {
            if (error.meta?.statusCode === 404) {
                return null;
            }
            return null;
        }
    }

    /**
     * Get all account configs
     */
    async getAll(): Promise<AccountConfigDocument[]> {
        try {
            const response = await this.esClient.search({
                index: this.INDEX,
                query: { match_all: {} },
                size: 100
            });

            return response.hits.hits.map((hit: any) => hit._source as AccountConfigDocument);
        } catch (error) {
            return [];
        }
    }

    /**
     * Get active account configs
     */
    async getActive(): Promise<AccountConfigDocument[]> {
        try {
            const response = await this.esClient.search({
                index: this.INDEX,
                query: {
                    term: { isActive: true }
                },
                size: 100
            });

            return response.hits.hits.map((hit: any) => hit._source as AccountConfigDocument);
        } catch (error) {
            return [];
        }
    }

    /**
     * Get account configs by user ID
     */
    async getByUserId(userId: string): Promise<AccountConfigDocument[]> {
        try {
            const response = await this.esClient.search({
                index: this.INDEX,
                query: {
                    term: { 'userId.keyword': userId }
                },
                size: 100
            });

            return response.hits.hits.map((hit: any) => hit._source as AccountConfigDocument);
        } catch (error) {
            return [];
        }
    }

    /**
     * Update account config by email
     */
    async updateByEmail(email: string, updates: Partial<AccountConfigDocument>): Promise<void> {
        const existingConfig = await this.getByEmail(email);
        if (!existingConfig) {
            throw new Error(`No account config found for email: ${email}`);
        }

        await this.esClient.update({
            index: this.INDEX,
            id: existingConfig.id,
            doc: updates
        });
    }

    /**
     * Update account config by ID
     */
    async updateById(accountId: string, updates: Partial<AccountConfigDocument>): Promise<void> {
        await this.esClient.update({
            index: this.INDEX,
            id: accountId,
            doc: updates,
            refresh: 'wait_for'
        });
    }

    /**
     * Update multiple account configs by user ID
     */
    async updateByUserId(userId: string, updates: Partial<AccountConfigDocument>): Promise<void> {
        await this.esClient.updateByQuery({
            index: this.INDEX,
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
    }

    /**
     * Delete account config by email
     */
    async deleteByEmail(email: string): Promise<void> {
        await this.esClient.deleteByQuery({
            index: this.INDEX,
            query: {
                term: { email: email }
            }
        });
    }

    /**
     * Delete account config by ID
     */
    async deleteById(accountId: string): Promise<void> {
        await this.esClient.delete({
            index: this.INDEX,
            id: accountId,
            refresh: 'wait_for'
        });
    }
}
