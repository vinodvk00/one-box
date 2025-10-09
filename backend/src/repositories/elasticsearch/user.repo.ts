import { Client } from '@elastic/elasticsearch';
import { nanoid } from 'nanoid';
import { IUserRepository } from '../interfaces/user.interface';
import { User, CreateUserInput, UserDocument } from '../../types/user.types';

/**
 * Elasticsearch User Repository
 *
 * Implements user data access using Elasticsearch.
 * This class follows the Repository Pattern and implements IUserRepository interface.
 */
export class ElasticsearchUserRepository implements IUserRepository {
    private readonly INDEX = 'users';

    /**
     * Constructor - Dependency Injection
     * @param esClient - Elasticsearch client 
     */
    constructor(private esClient: Client) {}

    /**
     * Create users index in Elasticsearch
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
                        password: { type: 'text', index: false },
                        name: { type: 'text' },
                        authMethod: { type: 'keyword' },
                        oauthProvider: { type: 'keyword' },
                        primaryEmailAccountId: { type: 'keyword' },
                        role: { type: 'keyword' },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'date' },
                        updatedAt: { type: 'date' },
                        lastLoginAt: { type: 'date' }
                    }
                }
            });
        }
    }

    /**
     * Create a new user
     */
    async create(input: CreateUserInput): Promise<User> {
        const now = new Date();
        const userId = `user_${nanoid(12)}`;

        const userDoc: UserDocument = {
            email: input.email,
            password: input.password,
            name: input.name,
            authMethod: input.authMethod,
            oauthProvider: input.oauthProvider,
            primaryEmailAccountId: undefined,
            role: input.role || 'user',
            isActive: true,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: undefined
        };

        await this.esClient.index({
            index: this.INDEX,
            id: userId,
            document: userDoc,
            refresh: 'wait_for'
        });

        return {
            id: userId,
            ...userDoc
        };
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        try {
            const response = await this.esClient.search({
                index: this.INDEX,
                query: {
                    term: { email: email.toLowerCase() }
                }
            });

            const hits = response.hits.hits;
            if (hits.length === 0) return null;

            const hit = hits[0];
            return {
                id: hit._id as string,
                ...(hit._source as UserDocument)
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Find user by ID
     */
    async findById(userId: string): Promise<User | null> {
        try {
            const response = await this.esClient.get({
                index: this.INDEX,
                id: userId
            });

            if (!response._source) return null;

            return {
                id: userId,
                ...(response._source as UserDocument)
            };
        } catch (error: any) {
            if (error.meta?.statusCode === 404) {
                return null;
            }
            return null;
        }
    }

    /**
     * Update user
     */
    async update(userId: string, updates: Partial<UserDocument>): Promise<void> {
        await this.esClient.update({
            index: this.INDEX,
            id: userId,
            doc: {
                ...updates,
                updatedAt: new Date()
            },
            refresh: 'wait_for'
        });
    }

    /**
     * Delete user
     */
    async delete(userId: string): Promise<void> {
        await this.esClient.delete({
            index: this.INDEX,
            id: userId,
            refresh: 'wait_for'
        });
    }

    /**
     * Check if user exists by email
     */
    async existsByEmail(email: string): Promise<boolean> {
        const user = await this.findByEmail(email);
        return user !== null;
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(userId: string): Promise<void> {
        await this.update(userId, { lastLoginAt: new Date() });
    }

    /**
     * Get all users (admin only)
     */
    async getAll(limit: number = 100): Promise<User[]> {
        try {
            const response = await this.esClient.search({
                index: this.INDEX,
                query: { match_all: {} },
                size: limit
            });

            return response.hits.hits.map((hit: any) => ({
                id: hit._id as string,
                ...(hit._source as UserDocument)
            }));
        } catch (error) {
            return [];
        }
    }
}
