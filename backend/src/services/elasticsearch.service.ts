import { Client } from '@elastic/elasticsearch';
import { categorizeEmail } from './ai-categorization.service';


let esClient: Client | null = null;

const getClient = () => {
    if (!esClient) {
        esClient = new Client({
            node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        });
    }
    return esClient;
};

export { getClient as client };

const EMAIL_INDEX = 'emails';

export interface EmailDocument {
    id: string;
    account: string;
    folder: string;
    subject: string;
    from: {
        name: string;
        address: string;
    };
    to: Array<{
        name: string;
        address: string;
    }>;
    date: Date;
    body: string;
    textBody?: string;
    htmlBody?: string;
    flags: string[];
    category?: string;
    uid: string;
}

export interface SearchFilters {
    account?: string;
    folder?: string;
    category?: string;
}

export const createIndex = async () => {
    try {
        console.time('    ⏱️  ES client connection');
        const client = getClient();
        console.timeEnd('    ⏱️  ES client connection');

        console.time('    🔍 Check if index exists');
        const exists = await client.indices.exists({ index: EMAIL_INDEX });
        console.timeEnd('    🔍 Check if index exists');

        if (!exists) {
            console.time('    ➕ Create index with mappings');
            await client.indices.create({
                index: EMAIL_INDEX,
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
            console.timeEnd('    ➕ Create index with mappings');
            console.log('Email index created with category support.');
        } else {
            console.log('Email index already exists, skipping creation.');
        }
    } catch (error: any) {
        if (error.meta?.body?.error?.type === 'resource_already_exists_exception') {
            console.log('Email index already exists, continuing...');
            return;
        }
        throw error;
    }
};

export const emailExists = async (id: string): Promise<boolean> => {
    try {
        const client = getClient();
        const exists = await client.exists({
            index: EMAIL_INDEX,
            id
        });
        return exists;
    } catch (error) {
        console.error(`Error checking email existence for ${id}:`, error);
        return false;
    }
};

export const getUncategorizedEmailIds = async (): Promise<string[]> => {
    try {
        const client = getClient();
        const result = await client.search({
            index: EMAIL_INDEX,
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
        console.error('Error fetching uncategorized email IDs:', error);
        return [];
    }
};

export const bulkIndexEmails = async (emails: EmailDocument[]): Promise<{ indexed: number; skipped: number }> => {
    if (emails.length === 0) return { indexed: 0, skipped: 0 };

    const client = getClient();

    try {
        const mgetResponse = await client.mget({
            index: EMAIL_INDEX,
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
            console.log(`All ${emails.length} emails already exist, skipping indexing.`);
            return { indexed: 0, skipped: emails.length };
        }

        const bulkBody = newEmails.flatMap(email => {
            const { id, ...emailBody } = email;
            return [
                { index: { _index: EMAIL_INDEX, _id: id } },
                emailBody
            ];
        });

        const bulkResponse = await client.bulk({
            body: bulkBody,
            refresh: false 
        });

        const errors = bulkResponse.items.filter((item: any) => item.index?.error);

        if (errors.length > 0) {
            console.error(`Bulk indexing had ${errors.length} errors:`, errors.slice(0, 3));
        }

        console.log(`✅ Bulk indexed ${newEmails.length} emails (skipped ${existingIds.size} existing)`);

        return {
            indexed: newEmails.length - errors.length,
            skipped: existingIds.size
        };
    } catch (error) {
        console.error('Bulk indexing failed:', error);
        throw error;
    }
};

// Keeping original for backwards compatibility
export const indexEmail = async (email: EmailDocument) => {
    await bulkIndexEmails([email]);
};

// Bulk update email categories
export const bulkUpdateEmailCategories = async (
    updates: Array<{ id: string; category: string }>
): Promise<void> => {
    if (updates.length === 0) return;

    try {
        const client = getClient();

        const bulkBody = updates.flatMap(({ id, category }) => [
            { update: { _index: EMAIL_INDEX, _id: id } },
            { doc: { category } }
        ]);

        const response = await client.bulk({
            body: bulkBody,
            refresh: false
        });

        const errors = response.items.filter((item: any) => item.update?.error);

        if (errors.length > 0) {
            console.error(`Bulk category update had ${errors.length} errors:`, errors.slice(0, 3));
        } else {
            console.log(`✅ Bulk updated ${updates.length} email categories`);
        }
    } catch (error) {
        console.error('Bulk category update failed:', error);
        throw error;
    }
};

// Keep original for backwards compatibility
export const updateEmailCategory = async (id: string, category: string): Promise<void> => {
    await bulkUpdateEmailCategories([{ id, category }]);
};

export const getEmailsByIds = async (ids: string[]): Promise<EmailDocument[]> => {
    if (ids.length === 0) return [];

    try {
        const client = getClient();
        const result = await client.mget({
            index: EMAIL_INDEX,
            body: {
                ids
            }
        });

        return result.docs
            .filter((doc: any) => doc.found)
            .map((doc: any) => ({
                id: doc._id,
                ...doc._source
            } as EmailDocument));
    } catch (error) {
        console.error('Error fetching emails by IDs:', error);
        return [];
    }
};

export const searchEmails = async (
    query: string,
    filters?: SearchFilters,
    pagination?: { page: number; limit: number }
) => {
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

    const client = getClient();
    const result = await client.search({
        index: EMAIL_INDEX,
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
};

export const getEmailById = async (id: string) => {
    const client = getClient();
    const result = await client.get({
        index: EMAIL_INDEX,
        id
    });

    return {
        id: result._id as string,
        ...(result._source as any)
    };
};

export const getCategoryStats = async () => {
    const client = getClient();
    const result = await client.search({
        index: EMAIL_INDEX,
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
};

export const getUncategorizedEmails = async () => {
    const client = getClient();
    const result = await client.search({
        index: EMAIL_INDEX,
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
};

export const categorizeEmailById = async (emailId: string) => {
    const emailResult = await getEmailById(emailId);
    const email = emailResult as EmailDocument;

    if (!email) {
        throw new Error('Email not found');
    }

    const result = await categorizeEmail({
        subject: email.subject,
        body: email.body,
        from: email.from
    });

    if (!result) {
        return null;
    }

    await updateEmailCategory(emailId, result.category);

    return result;
};

export const deleteEmailsByAccount = async (account: string): Promise<number> => {
    const client = getClient();
    const result = await client.deleteByQuery({
        index: EMAIL_INDEX,
        query: {
            term: { account: account }
        }
    });
    return result.deleted || 0;
};

export const getEmailCountByAccount = async (account: string): Promise<number> => {
    const client = getClient();
    const result = await client.count({
        index: EMAIL_INDEX,
        query: {
            term: { account: account }
        }
    });
    return result.count;
};

export const getAccountStats = async (): Promise<Array<{ account: string; count: number }>> => {
    const client = getClient();
    const result = await client.search({
        index: EMAIL_INDEX,
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
};