import { Client } from '@elastic/elasticsearch';
import { IEmailRepository } from '../interfaces/email.interface';
import { EmailDocument, SearchFilters } from '../../types/email.types';

/**
 * Elasticsearch Email Repository
 *
 * Manages email data storage and retrieval
 */
export class ElasticsearchEmailRepository implements IEmailRepository {
    private readonly INDEX = 'emails';

    constructor(private esClient: Client) {}

    /**
     * Create emails index
     */
    async createIndex(): Promise<void> {
        try {
            const exists = await this.esClient.indices.exists({ index: this.INDEX });

            if (!exists) {
                await this.esClient.indices.create({
                    index: this.INDEX,
                    settings: {
                        analysis: {
                            normalizer: {
                                lowercase_normalizer: {
                                    type: "custom",
                                    filter: ["lowercase"]
                                }
                            }
                        }
                    },
                    mappings: {
                        properties: {
                            account: { type: 'keyword' },
                            folder: {
                                type: 'keyword',
                                normalizer: 'lowercase_normalizer'
                            },
                            subject: { type: 'text' },
                            from: {
                                properties: {
                                    name: { type: 'text' },
                                    address: { type: 'keyword' }
                                }
                            },
                            to: {
                                type: 'nested',
                                properties: {
                                    name: { type: 'text' },
                                    address: { type: 'keyword' }
                                }
                            },
                            date: { type: 'date' },
                            body: { type: 'text' },
                            textBody: { type: 'text' },
                            htmlBody: { type: 'text' },
                            flags: { type: 'keyword' },
                            category: { type: 'keyword' },
                            uid: { type: 'keyword' }
                        }
                    }
                });
            }
        } catch (error: any) {
            if (error.meta?.body?.error?.type === 'resource_already_exists_exception') {
                return;
            }
            throw error;
        }
    }

    /**
     * Check if email exists
     */
    async exists(emailId: string): Promise<boolean> {
        try {
            const exists = await this.esClient.exists({
                index: this.INDEX,
                id: emailId
            });
            return exists;
        } catch (error) {
            return false;
        }
    }

    /**
     * Index a single email
     */
    async index(email: EmailDocument): Promise<void> {
        await this.bulkIndex([email]);
    }

    /**
     * Bulk index emails
     */
    async bulkIndex(emails: EmailDocument[]): Promise<{ indexed: number; skipped: number }> {
        if (emails.length === 0) return { indexed: 0, skipped: 0 };

        try {
            const mgetResponse = await this.esClient.mget({
                index: this.INDEX,
                body: {
                    ids: emails.map(e => e.id)
                }
            });

            const existingIds = new Set(
                mgetResponse.docs
                    .filter((doc: any) => doc.found)
                    .map((doc: any) => doc._id)
            );

            const newEmails = emails.filter(email => !existingIds.has(email.id));

            if (newEmails.length === 0) {
                return { indexed: 0, skipped: emails.length };
            }

            const bulkBody = newEmails.flatMap(email => {
                const { id, ...emailBody } = email;
                return [
                    { index: { _index: this.INDEX, _id: id } },
                    emailBody
                ];
            });

            const bulkResponse = await this.esClient.bulk({
                body: bulkBody,
                refresh: false
            });

            const errors = bulkResponse.items.filter((item: any) => item.index?.error);

            return {
                indexed: newEmails.length - errors.length,
                skipped: existingIds.size
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get email by ID
     */
    async getById(emailId: string): Promise<EmailDocument> {
        const result = await this.esClient.get({
            index: this.INDEX,
            id: emailId
        });

        return {
            id: result._id as string,
            ...(result._source as any)
        };
    }

    /**
     * Get multiple emails by IDs
     */
    async getByIds(emailIds: string[]): Promise<EmailDocument[]> {
        if (emailIds.length === 0) return [];

        try {
            const result = await this.esClient.mget({
                index: this.INDEX,
                body: {
                    ids: emailIds
                }
            });

            return result.docs
                .filter((doc: any) => doc.found)
                .map((doc: any) => ({
                    id: doc._id,
                    ...doc._source
                } as EmailDocument));
        } catch (error) {
            return [];
        }
    }

    /**
     * Update email category
     */
    async updateCategory(emailId: string, category: string): Promise<void> {
        await this.bulkUpdateCategories([{ id: emailId, category }]);
    }

    /**
     * Bulk update email categories
     */
    async bulkUpdateCategories(updates: Array<{ id: string; category: string }>): Promise<void> {
        if (updates.length === 0) return;

        try {
            const bulkBody = updates.flatMap(({ id, category }) => [
                { update: { _index: this.INDEX, _id: id } },
                { doc: { category } }
            ]);

            await this.esClient.bulk({
                body: bulkBody,
                refresh: false
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Search emails
     */
    async search(
        query: string,
        filters?: SearchFilters,
        pagination?: { page: number; limit: number }
    ): Promise<{
        emails: EmailDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const searchBody: any = {
            query: {
                bool: {
                    must: []
                }
            },
            sort: [
                { date: { order: 'desc' } }
            ]
        };

        if (query) {
            searchBody.query.bool.must.push({
                multi_match: {
                    query,
                    fields: ['subject', 'body', 'from.name', 'from.address']
                }
            });
        }

        if (filters?.account) {
            searchBody.query.bool.must.push({
                term: { account: filters.account }
            });
        }

        if (filters?.folder) {
            searchBody.query.bool.must.push({
                term: { folder: filters.folder }
            });
        }

        if (filters?.category) {
            searchBody.query.bool.must.push({
                term: { category: filters.category }
            });
        }

        if (pagination) {
            const { page, limit } = pagination;
            const from = (page - 1) * limit;
            searchBody.size = limit;
            searchBody.from = from;
        } else {
            searchBody.size = 1000;
        }

        const result = await this.esClient.search({
            index: this.INDEX,
            body: searchBody
        });

        const emails = result.hits.hits.map(hit => ({
            id: hit._id as string,
            ...(hit._source as any)
        }));

        const totalHits = typeof result.hits.total === 'number'
            ? result.hits.total
            : result.hits.total?.value || 0;

        return {
            emails,
            total: totalHits,
            page: pagination?.page || 1,
            limit: pagination?.limit || emails.length,
            totalPages: pagination
                ? Math.ceil(totalHits / pagination.limit)
                : 1
        };
    }

    /**
     * Get uncategorized email IDs
     */
    async getUncategorizedIds(): Promise<string[]> {
        try {
            const result = await this.esClient.search({
                index: this.INDEX,
                body: {
                    size: 10000,
                    _source: false,
                    query: {
                        bool: {
                            must_not: {
                                exists: {
                                    field: 'category'
                                }
                            }
                        }
                    },
                    sort: [
                        { date: { order: 'asc' } }
                    ]
                }
            });

            return result.hits.hits.map(hit => hit._id as string);
        } catch (error) {
            return [];
        }
    }

    /**
     * Get uncategorized emails (full documents)
     */
    async getUncategorized(): Promise<EmailDocument[]> {
        try {
            const result = await this.esClient.search({
                index: this.INDEX,
                body: {
                    query: {
                        bool: {
                            must_not: {
                                exists: {
                                    field: 'category'
                                }
                            }
                        }
                    },
                    sort: [
                        { date: { order: 'desc' } }
                    ]
                }
            });

            return result.hits.hits.map(hit => ({
                id: hit._id as string,
                ...(hit._source as any)
            }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Get category statistics
     */
    async getCategoryStats(): Promise<Array<{ category: string; count: number }>> {
        try {
            const result = await this.esClient.search({
                index: this.INDEX,
                body: {
                    size: 0,
                    aggs: {
                        categories: {
                            terms: {
                                field: 'category',
                                missing: 'uncategorized'
                            }
                        }
                    }
                }
            });

            const buckets = (result.aggregations as any)?.categories?.buckets || [];
            return buckets.map((bucket: any) => ({
                category: bucket.key,
                count: bucket.doc_count
            }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Get account statistics
     */
    async getAccountStats(): Promise<Array<{ account: string; count: number }>> {
        try {
            const result = await this.esClient.search({
                index: this.INDEX,
                size: 0,
                aggs: {
                    accounts: {
                        terms: {
                            field: 'account',
                            size: 100
                        }
                    }
                }
            });

            const buckets = (result.aggregations as any)?.accounts?.buckets || [];
            return buckets.map((bucket: any) => ({
                account: bucket.key,
                count: bucket.doc_count
            }));
        } catch (error) {
            return [];
        }
    }

    /**
     * Get email count by account
     */
    async getCountByAccount(account: string): Promise<number> {
        try {
            const result = await this.esClient.count({
                index: this.INDEX,
                query: {
                    term: { account: account }
                }
            });
            return result.count;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Delete emails by account
     */
    async deleteByAccount(account: string): Promise<number> {
        const result = await this.esClient.deleteByQuery({
            index: this.INDEX,
            query: {
                term: { account: account }
            }
        });
        return result.deleted || 0;
    }
}
