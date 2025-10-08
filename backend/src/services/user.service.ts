import { client as getClient } from './elasticsearch.service';
import { User, UserDocument, CreateUserInput, toUserResponse } from '../types/user.types';
import { nanoid } from 'nanoid';

const USERS_INDEX = 'users';

/**
 * Create the users index in Elasticsearch
 */
export const createUsersIndex = async (): Promise<void> => {
    console.time('    🔍 Check users index');
    const client = getClient();
    const indexExists = await client.indices.exists({ index: USERS_INDEX });
    console.timeEnd('    🔍 Check users index');

    if (!indexExists) {
        console.time('    ➕ Create users index');
        await client.indices.create({
            index: USERS_INDEX,
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
        console.timeEnd('    ➕ Create users index');
        console.log(`✅ Created ${USERS_INDEX} index`);
    }
};

/**
 * Create a new user
 */
export const createUser = async (input: CreateUserInput): Promise<User> => {
    const client = getClient();
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

    await client.index({
        index: USERS_INDEX,
        id: userId,
        document: userDoc,
        refresh: 'wait_for'
    });

    return {
        id: userId,
        ...userDoc
    };
};

/**
 * Find user by email
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
    try {
        const client = getClient();
        const response = await client.search({
            index: USERS_INDEX,
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
        console.error('Error finding user by email:', error);
        return null;
    }
};

/**
 * Find user by ID
 */
export const findUserById = async (userId: string): Promise<User | null> => {
    try {
        const client = getClient();
        const response = await client.get({
            index: USERS_INDEX,
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
        console.error('Error finding user by ID:', error);
        return null;
    }
};

/**
 * Update user
 */
export const updateUser = async (userId: string, updates: Partial<UserDocument>): Promise<void> => {
    const client = getClient();
    await client.update({
        index: USERS_INDEX,
        id: userId,
        doc: {
            ...updates,
            updatedAt: new Date()
        },
        refresh: 'wait_for'
    });
};

/**
 * Delete user
 */
export const deleteUser = async (userId: string): Promise<void> => {
    const client = getClient();
    await client.delete({
        index: USERS_INDEX,
        id: userId,
        refresh: 'wait_for'
    });
};

/**
 * Check if user exists by email
 */
export const userExistsByEmail = async (email: string): Promise<boolean> => {
    const user = await findUserByEmail(email);
    return user !== null;
};

/**
 * Update last login timestamp
 */
export const updateLastLogin = async (userId: string): Promise<void> => {
    await updateUser(userId, { lastLoginAt: new Date() });
};

/**
 * Get all users (admin only)
 */
export const getAllUsers = async (limit: number = 100): Promise<User[]> => {
    try {
        const client = getClient();
        const response = await client.search({
            index: USERS_INDEX,
            query: { match_all: {} },
            size: limit
        });

        return response.hits.hits.map((hit: any) => ({
            id: hit._id as string,
            ...(hit._source as UserDocument)
        }));
    } catch (error) {
        console.error('Error getting all users:', error);
        return [];
    }
};
