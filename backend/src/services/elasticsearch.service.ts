import { Client } from '@elastic/elasticsearch';
import { categorizeEmail } from './ai-categorization.service';


const esClient = new Client({
    node: 'http://localhost:9200',
});

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
        const exists = await esClient.indices.exists({ index: EMAIL_INDEX });

        if (!exists) {
            await esClient.indices.create({
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
        const exists = await esClient.exists({
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
        const result = await esClient.search({
            index: EMAIL_INDEX,
            body: {
                size: 10000, // Adjust based on your needs
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
                    { date: { order: 'asc' } } // Process oldest first
                ]
            }
        });

        return result.hits.hits.map(hit => hit._id as string);
    } catch (error) {
        console.error('Error fetching uncategorized email IDs:', error);
        return [];
    }
};

export const indexEmail = async (email: EmailDocument) => {
    const { id, ...emailBody } = email;

    // Check if email already exists
    const exists = await emailExists(id);
    if (exists) {
        console.log(`Email ${id} already exists, skipping indexing.`);
        return;
    }

    await esClient.index({
        index: EMAIL_INDEX,
        id: email.id,
        body: emailBody
    });
};

export const updateEmailCategory = async (id: string, category: string): Promise<void> => {
    try {
        await esClient.update({
            index: EMAIL_INDEX,
            id,
            body: {
                doc: {
                    category
                }
            }
        });
    } catch (error) {
        console.error(`Failed to update category for email ${id}:`, error);
        throw error;
    }
};

export const getEmailsByIds = async (ids: string[]): Promise<EmailDocument[]> => {
    if (ids.length === 0) return [];

    try {
        const result = await esClient.mget({
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

export const searchEmails = async (query: string, filters?: SearchFilters) => {
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

    const result = await esClient.search({
        index: EMAIL_INDEX,
        body: searchBody
    });

    return result.hits.hits.map(hit => ({
        id: hit._id as string,
        ...(hit._source as any)
    }));
};

export const getEmailById = async (id: string) => {
    const result = await esClient.get({
        index: EMAIL_INDEX,
        id
    });

    return {
        id: result._id as string,
        ...(result._source as any)
    };
};

export const getCategoryStats = async () => {
    const result = await esClient.search({
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
    const result = await esClient.search({
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