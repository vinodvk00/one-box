/**
 * PostgreSQL User Repository
 *
 * Implements user data access using PostgreSQL with proper ACID transactions
 */

import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import { IUserRepository } from '../interfaces/user.interface';
import { User, CreateUserInput, UserDocument } from '../../types/user.types';

export class PostgresUserRepository implements IUserRepository {
    constructor(private pool: Pool) {}

    /**
     * Create users table (handled by schema.sql)
     */
    async createIndex(): Promise<void> {
        // Table creation is handled by schema.sql
        // This method exists to satisfy the interface
        // todo: if not used remove from interface
        console.log('ℹ️  User table managed by schema.sql');
    }

    /**
     * Create a new user
     */
    async create(input: CreateUserInput): Promise<User> {
        const userId = `user_${nanoid(12)}`;
        const now = new Date();

        const result = await this.pool.query<User>(
            `INSERT INTO users (
                id, email, password, name, auth_method, oauth_provider, role, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                userId,
                input.email.toLowerCase(),
                input.password || null,
                input.name,
                input.authMethod,
                input.oauthProvider || null,
                input.role || 'user',
                true, // is_active
                now,
                now
            ]
        );

        return this.mapRowToUser(result.rows[0]);
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        const result = await this.pool.query<User>(
            `SELECT * FROM users WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToUser(result.rows[0]);
    }

    /**
     * Find user by ID
     */
    async findById(userId: string): Promise<User | null> {
        const result = await this.pool.query<User>(
            `SELECT * FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToUser(result.rows[0]);
    }

    /**
     * Update user
     */
    async update(userId: string, updates: Partial<UserDocument>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        // Build dynamic UPDATE query
        for (const [key, value] of Object.entries(updates)) {
            // Convert camelCase to snake_case
            const snakeKey = this.toSnakeCase(key);
            fields.push(`${snakeKey} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }

        if (fields.length === 0) {
            return; 
        }

        fields.push(`updated_at = $${paramIndex}`);
        values.push(new Date());
        paramIndex++;

        values.push(userId);

        const query = `
            UPDATE users
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex}
        `;

        await this.pool.query(query, values);
    }

    /**
     * Delete user
     */
    async delete(userId: string): Promise<void> {
        await this.pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    }

    /**
     * Check if user exists by email
     */
    async existsByEmail(email: string): Promise<boolean> {
        const result = await this.pool.query(
            `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`,
            [email.toLowerCase()]
        );
        return result.rows[0].exists;
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(userId: string): Promise<void> {
        await this.pool.query(
            `UPDATE users SET last_login_at = $1, updated_at = $1 WHERE id = $2`,
            [new Date(), userId]
        );
    }

    /**
     * Get all users (admin only)
     */
    async getAll(limit: number = 100): Promise<User[]> {
        const result = await this.pool.query<User>(
            `SELECT * FROM users ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );

        return result.rows.map(row => this.mapRowToUser(row));
    }

    /**
     * Map database row to User object (convert snake_case to camelCase)
     */
    private mapRowToUser(row: any): User {
        return {
            id: row.id,
            email: row.email,
            password: row.password || undefined,
            name: row.name,
            authMethod: row.auth_method,
            oauthProvider: row.oauth_provider || undefined,
            primaryEmailAccountId: row.primary_email_account_id || undefined,
            role: row.role,
            isActive: row.is_active,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined
        };
    }

    /**
     * Convert camelCase to snake_case
     */
    private toSnakeCase(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}
