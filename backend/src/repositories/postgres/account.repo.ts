/**
 * PostgreSQL Account Repository
 * Manages email account configurations with foreign key relationships
 */

import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import { IAccountRepository } from '../interfaces/account.interface';
import { AccountConfigDocument } from '../../types/auth.types';

export class PostgresAccountRepository implements IAccountRepository {
    constructor(private pool: Pool) {}

    /**
     * Create table (handled by schema.sql)
     */
    async createIndex(): Promise<void> {
        console.log('ℹ️  Email accounts table managed by schema.sql');
    }

    /**
     * Store account configuration
     */
    async store(configDoc: AccountConfigDocument): Promise<void> {
        await this.pool.query(
            `INSERT INTO email_accounts (
                id, user_id, email, auth_type, is_primary, is_active,
                imap_config, created_at, last_sync_at, sync_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id, email)
            DO UPDATE SET
                auth_type = EXCLUDED.auth_type,
                is_primary = EXCLUDED.is_primary,
                is_active = EXCLUDED.is_active,
                imap_config = EXCLUDED.imap_config,
                sync_status = EXCLUDED.sync_status`,
            [
                configDoc.id,
                configDoc.userId,
                configDoc.email.toLowerCase(),
                configDoc.authType,
                configDoc.isPrimary || false,
                configDoc.isActive,
                configDoc.imapConfig ? JSON.stringify(configDoc.imapConfig) : null,
                configDoc.createdAt || new Date(),
                configDoc.lastSyncAt || null,
                configDoc.syncStatus || 'idle'
            ]
        );
    }

    /**
     * Get account config by email
     */
    async getByEmail(email: string): Promise<AccountConfigDocument | null> {
        const result = await this.pool.query(
            `SELECT * FROM email_accounts WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToAccountConfig(result.rows[0]);
    }

    /**
     * Get account config by ID
     */
    async getById(accountId: string): Promise<AccountConfigDocument | null> {
        const result = await this.pool.query(
            `SELECT * FROM email_accounts WHERE id = $1`,
            [accountId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToAccountConfig(result.rows[0]);
    }

    /**
     * Get all account configs
     */
    async getAll(): Promise<AccountConfigDocument[]> {
        const result = await this.pool.query(
            `SELECT * FROM email_accounts ORDER BY created_at DESC`
        );

        return result.rows.map(row => this.mapRowToAccountConfig(row));
    }

    /**
     * Get active account configs
     */
    async getActive(): Promise<AccountConfigDocument[]> {
        const result = await this.pool.query(
            `SELECT * FROM email_accounts WHERE is_active = true ORDER BY created_at DESC`
        );

        return result.rows.map(row => this.mapRowToAccountConfig(row));
    }

    /**
     * Get account configs by user ID
     */
    async getByUserId(userId: string): Promise<AccountConfigDocument[]> {
        const result = await this.pool.query(
            `SELECT * FROM email_accounts WHERE user_id = $1 ORDER BY is_primary DESC, created_at DESC`,
            [userId]
        );

        return result.rows.map(row => this.mapRowToAccountConfig(row));
    }

    /**
     * Update account config by email
     */
    async updateByEmail(email: string, updates: Partial<AccountConfigDocument>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = this.toSnakeCase(key);

            // Handle JSONB fields
            if (key === 'imapConfig') {
                fields.push(`imap_config = $${paramIndex}`);
                values.push(value ? JSON.stringify(value) : null);
            } else {
                fields.push(`${snakeKey} = $${paramIndex}`);
                values.push(value);
            }
            paramIndex++;
        }

        if (fields.length === 0) return;

        values.push(email.toLowerCase());

        const query = `UPDATE email_accounts SET ${fields.join(', ')} WHERE email = $${paramIndex}`;
        await this.pool.query(query, values);
    }

    /**
     * Update account config by ID
     */
    async updateById(accountId: string, updates: Partial<AccountConfigDocument>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = this.toSnakeCase(key);

            if (key === 'imapConfig') {
                fields.push(`imap_config = $${paramIndex}`);
                values.push(value ? JSON.stringify(value) : null);
            } else {
                fields.push(`${snakeKey} = $${paramIndex}`);
                values.push(value);
            }
            paramIndex++;
        }

        if (fields.length === 0) return;

        values.push(accountId);

        const query = `UPDATE email_accounts SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
        await this.pool.query(query, values);
    }

    /**
     * Update multiple account configs by user ID
     */
    async updateByUserId(userId: string, updates: Partial<AccountConfigDocument>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = this.toSnakeCase(key);

            if (key === 'imapConfig') {
                fields.push(`imap_config = $${paramIndex}`);
                values.push(value ? JSON.stringify(value) : null);
            } else {
                fields.push(`${snakeKey} = $${paramIndex}`);
                values.push(value);
            }
            paramIndex++;
        }

        if (fields.length === 0) return;

        values.push(userId);

        const query = `UPDATE email_accounts SET ${fields.join(', ')} WHERE user_id = $${paramIndex}`;
        await this.pool.query(query, values);
    }

    /**
     * Delete account config by email
     */
    async deleteByEmail(email: string): Promise<void> {
        await this.pool.query(`DELETE FROM email_accounts WHERE email = $1`, [email.toLowerCase()]);
    }

    /**
     * Delete account config by ID
     */
    async deleteById(accountId: string): Promise<void> {
        await this.pool.query(`DELETE FROM email_accounts WHERE id = $1`, [accountId]);
    }

    /**
     * Map database row to AccountConfigDocument
     */
    private mapRowToAccountConfig(row: any): AccountConfigDocument {
        return {
            id: row.id,
            userId: row.user_id,
            email: row.email,
            authType: row.auth_type,
            isPrimary: row.is_primary,
            isActive: row.is_active,
            imapConfig: row.imap_config ? (typeof row.imap_config === 'string' ? JSON.parse(row.imap_config) : row.imap_config) : undefined,
            createdAt: new Date(row.created_at),
            lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
            syncStatus: row.sync_status
        };
    }

    /**
     * Convert camelCase to snake_case
     */
    private toSnakeCase(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}
