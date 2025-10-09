import { Client } from '@elastic/elasticsearch';
import { IOAuthRepository } from '../interfaces/oauth.interface';
import { OAuthTokenDocument } from '../../types/auth.types';

/**
 * Elasticsearch OAuth Repository
 *
 * Manages OAuth tokens in Elasticsearch (encrypted storage)
 */
export class ElasticsearchOAuthRepository implements IOAuthRepository {
    private readonly INDEX = 'oauth_tokens';

    constructor(private esClient: Client) {}

    /**
     * Create OAuth tokens index
     */
    async createIndex(): Promise<void> {
        const indexExists = await this.esClient.indices.exists({ index: this.INDEX });

        if (!indexExists) {
            await this.esClient.indices.create({
                index: this.INDEX,
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
        }
    }

    /**
     * Store OAuth tokens
     */
    async storeTokens(tokenDoc: OAuthTokenDocument): Promise<void> {
        await this.esClient.index({
            index: this.INDEX,
            id: tokenDoc.id,
            document: tokenDoc,
            refresh: 'wait_for'
        });
    }

    /**
     * Get OAuth tokens by email
     */
    async getTokens(email: string): Promise<OAuthTokenDocument | null> {
        try {
            const documentId = `oauth_${email}`;

            // Try direct get first
            try {
                const directResult = await this.esClient.get({
                    index: this.INDEX,
                    id: documentId
                });

                if (directResult._source) {
                    return directResult._source as OAuthTokenDocument;
                }
            } catch (directError: any) {
                // Document not found with direct ID, try search
                // TODO: add proper error handling/logging here
            }

            // Fallback to search
            const response = await this.esClient.search({
                index: this.INDEX,
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
            return null;
        }
    }

    /**
     * Update OAuth tokens
     */
    async updateTokens(email: string, updates: Partial<OAuthTokenDocument>): Promise<void> {
        const existingTokens = await this.getTokens(email);
        if (!existingTokens) {
            throw new Error(`No OAuth tokens found for email: ${email}`);
        }

        await this.esClient.update({
            index: this.INDEX,
            id: existingTokens.id,
            doc: {
                ...updates,
                lastUsed: new Date()
            }
        });
    }

    /**
     * Delete OAuth tokens
     */
    async deleteTokens(email: string): Promise<void> {
        await this.esClient.deleteByQuery({
            index: this.INDEX,
            query: {
                term: { email: email }
            }
        });
    }
}
